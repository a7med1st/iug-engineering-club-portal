import crypto from "node:crypto";

import {
  prisma,
} from "@/lib/prisma";

export function normalizeCertificateCode(
  value: string,
) {
  return value
    .trim()
    .toUpperCase()
    .replace(
      /\s+/g,
      "",
    );
}

export function createVerificationCode() {
  const year =
    new Date()
      .getFullYear();

  const token =
    crypto
      .randomBytes(6)
      .toString("hex")
      .toUpperCase();

  return `EC-${year}-${token}`;
}

export async function getCertificateByCode(
  rawCode: string,
) {
  const code =
    normalizeCertificateCode(
      rawCode,
    );

  if (!code) {
    return null;
  }

  return prisma.certificate.findUnique({
    where: {
      verificationCode:
        code,
    },

    include: {
      submission: {
        select: {
          id: true,
          userId: true,
          studentName:
            true,
          studentEmail:
            true,
          studentDepartment:
            true,
          status: true,
          checkedInAt:
            true,

          form: {
            select: {
              activity: {
                select: {
                  id: true,
                  title: true,
                  location: true,
                  startsAt: true,

                  departments: {
                    select: {
                      department: {
                        select: {
                          nameAr:
                            true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
}

export async function getCertificateAdminRows({
  activityId,
  issued,
}: {
  activityId:
    | string
    | null;

  issued:
    | "ALL"
    | "ISSUED"
    | "NOT_ISSUED";
}) {
  const activities =
    await prisma.activity.findMany({
      where: {
        registrationForm: {
          isNot: null,
        },
      },

      select: {
        id: true,
        title: true,
        startsAt: true,
        status: true,
      },

      orderBy: {
        startsAt:
          "desc",
      },
    });

  const selectedActivity =
    activityId
      ? activities.find(
          (activity) =>
            activity.id ===
            activityId,
        ) ?? null
      : null;

  const submissions =
    await prisma.activityFormSubmission.findMany({
      where: {
        status:
          "APPROVED",

        checkedInAt: {
          not: null,
        },

        ...(selectedActivity
          ? {
              form: {
                activityId:
                  selectedActivity.id,
              },
            }
          : {}),
      },

      select: {
        id: true,
        userId: true,
        studentName: true,
        studentEmail: true,
        studentDepartment:
          true,
        checkedInAt: true,

        certificate: {
          select: {
            id: true,
            verificationCode:
              true,
            issuedAt: true,
            revokedAt: true,
          },
        },

        form: {
          select: {
            activity: {
              select: {
                id: true,
                title: true,
                startsAt: true,
              },
            },
          },
        },
      },

      orderBy: {
        checkedInAt:
          "desc",
      },
    });

  const filtered =
    submissions.filter(
      (submission) => {
        if (
          issued ===
            "ISSUED"
        ) {
          return Boolean(
            submission.certificate &&
              !submission.certificate
                .revokedAt,
          );
        }

        if (
          issued ===
            "NOT_ISSUED"
        ) {
          return (
            !submission.certificate ||
            Boolean(
              submission.certificate
                .revokedAt,
            )
          );
        }

        return true;
      },
    );

  return {
    activities,
    selectedActivity,
    rows: filtered,

    summary: {
      eligibleCount:
        submissions.length,

      issuedCount:
        submissions.filter(
          (submission) =>
            Boolean(
              submission.certificate &&
                !submission.certificate
                  .revokedAt,
            ),
        ).length,

      notIssuedCount:
        submissions.filter(
          (submission) =>
            !submission.certificate ||
            Boolean(
              submission.certificate
                .revokedAt,
            ),
        ).length,
    },
  };
}
