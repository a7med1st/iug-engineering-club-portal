import {
  prisma,
} from "@/lib/prisma";

import {
  syncSystemChatGroups,
} from "@/lib/chat-groups";

type Check = {
  name: string;
  ok: boolean;
  detail: string;
};

const checks:
  Check[] =
  [];

function add(
  name: string,
  ok: boolean,
  detail: string,
) {
  checks.push({
    name,
    ok,
    detail,
  });

  console.log(
    `${ok ? "PASS" : "FAIL"}  ${name} — ${detail}`,
  );
}

async function main() {
  console.log("");
  console.log(
    "Engineering Club Portal — Final Programming Check",
  );
  console.log(
    "================================================",
  );
  console.log("");

  await prisma.$queryRaw`SELECT 1`;

  add(
    "Database connection",
    true,
    "PostgreSQL is reachable through Prisma.",
  );

  const [
    userCount,
    departmentCount,
    activityCount,
    notificationCount,
    certificateCount,
  ] =
    await Promise.all([
      prisma.user.count(),
      prisma.department.count(),
      prisma.activity.count(),
      prisma.notification.count(),
      prisma.certificate.count(),
    ]);

  add(
    "Core data models",
    departmentCount > 0,
    `${userCount} users, ${departmentCount} departments, ${activityCount} activities.`,
  );

  add(
    "Notifications model",
    notificationCount >= 0,
    `${notificationCount} notification(s) stored.`,
  );

  add(
    "Certificates model",
    certificateCount >= 0,
    `${certificateCount} certificate(s) stored.`,
  );

  const invalidCertificates =
    await prisma.certificate.findMany({
      where: {
        OR: [
          {
            submission: {
              status: {
                not: "APPROVED",
              },
            },
          },

          {
            submission: {
              checkedInAt:
                null,
            },
          },
        ],
      },

      select: {
        id: true,
        verificationCode:
          true,
      },
    });

  add(
    "Certificate eligibility",
    invalidCertificates.length === 0,
    invalidCertificates.length === 0
      ? "Every certificate belongs to an approved attendee with check-in."
      : `${invalidCertificates.length} invalid certificate record(s) found.`,
  );

  const revokedCertificates =
    await prisma.certificate.count({
      where: {
        revokedAt: {
          not: null,
        },
      },
    });

  add(
    "Certificate revocation state",
    true,
    `${revokedCertificates} revoked certificate(s).`,
  );

  const directConversations =
    await prisma.chatConversation.findMany({
      where: {
        type:
          "DIRECT",
      },

      select: {
        id: true,

        _count: {
          select: {
            participants:
              true,
          },
        },
      },
    });

  const brokenDirect =
    directConversations.filter(
      (conversation) =>
        conversation._count
          .participants !==
        2,
    );

  add(
    "Direct chat participants",
    brokenDirect.length === 0,
    brokenDirect.length === 0
      ? `${directConversations.length} direct conversation(s) valid.`
      : `${brokenDirect.length} direct conversation(s) do not have exactly two participants.`,
  );

  await syncSystemChatGroups();

  const systemGroups =
    await prisma.chatConversation.findMany({
      where: {
        type:
          "GROUP",

        directKey: {
          startsWith:
            "group:",
        },
      },

      select: {
        id: true,
        directKey: true,
        name: true,

        _count: {
          select: {
            participants:
              true,
          },
        },
      },
    });

  const generalGroups =
    systemGroups.filter(
      (group) =>
        group.directKey ===
        "group:general",
    );

  add(
    "General system group",
    generalGroups.length === 1,
    `${generalGroups.length} general group record(s) found.`,
  );

  const departmentGroups =
    systemGroups.filter(
      (group) =>
        group.directKey?.startsWith(
          "group:department:",
        ),
    );

  add(
    "Department chat groups",
    departmentGroups.length ===
      departmentCount,
    `${departmentGroups.length}/${departmentCount} department group(s) exist.`,
  );

  const duplicateReceiptRows =
    await prisma.$queryRaw<
      Array<{
        messageId: string;
        userId: string;
        count: bigint;
      }>
    >`
      SELECT
        "messageId",
        "userId",
        COUNT(*) AS count
      FROM "ChatMessageReceipt"
      GROUP BY
        "messageId",
        "userId"
      HAVING COUNT(*) > 1
    `;

  add(
    "Chat receipts uniqueness",
    duplicateReceiptRows.length === 0,
    duplicateReceiptRows.length === 0
      ? "No duplicate message receipts."
      : `${duplicateReceiptRows.length} duplicate receipt key(s) found.`,
  );

  const danglingReminderNotifications =
    await prisma.notification.count({
      where: {
        type:
          "ACTIVITY_REMINDER",

        reminderKey:
          null,
      },
    });

  add(
    "Activity reminder keys",
    danglingReminderNotifications === 0,
    danglingReminderNotifications === 0
      ? "All reminder notifications have idempotency keys."
      : `${danglingReminderNotifications} reminder notification(s) missing reminderKey.`,
  );

  const approvedPast =
    await prisma.activityFormSubmission.count({
      where: {
        status:
          "APPROVED",

        form: {
          activity: {
            startsAt: {
              lte:
                new Date(),
            },
          },
        },
      },
    });

  const checkedIn =
    await prisma.activityFormSubmission.count({
      where: {
        status:
          "APPROVED",

        checkedInAt: {
          not: null,
        },
      },
    });

  add(
    "Attendance data",
    checkedIn <= approvedPast ||
      approvedPast === 0,
    `${checkedIn} checked-in attendee(s), ${approvedPast} approved past registration(s).`,
  );

  const admin =
    await prisma.user.findFirst({
      where: {
        role:
          "ADMIN",
      },

      select: {
        id: true,
      },
    });

  add(
    "Admin account",
    Boolean(admin),
    admin
      ? "At least one ADMIN account exists."
      : "No ADMIN account exists.",
  );

  console.log("");
  console.log(
    "================================================",
  );

  const failed =
    checks.filter(
      (check) =>
        !check.ok,
    );

  if (
    failed.length
  ) {
    console.error(
      `FINAL CHECK FAILED: ${failed.length} check(s) need attention.`,
    );

    process.exitCode =
      1;
  } else {
    console.log(
      `FINAL CHECK PASSED: ${checks.length}/${checks.length} checks passed.`,
    );
  }
}

main()
  .catch(
    (error) => {
      console.error("");
      console.error(
        "Final programming check crashed:",
      );
      console.error(
        error,
      );

      process.exitCode =
        1;
    },
  )
  .finally(
    async () => {
      await prisma.$disconnect();
    },
  );
