"use server";

import {
  Prisma,
} from "@prisma/client";

import {
  revalidatePath,
} from "next/cache";

import {
  redirect,
} from "next/navigation";

import {
  createVerificationCode,
} from "@/lib/certificates";

import {
  PERMISSIONS,
  requirePermission,
} from "@/lib/permissions";

import {
  prisma,
} from "@/lib/prisma";

function field(
  formData: FormData,
  name: string,
) {
  return String(
    formData.get(
      name,
    ) ?? "",
  ).trim();
}

function certificateAdminError(
  message: string,
): never {
  redirect(
    `/admin/certificates?error=${encodeURIComponent(
      message,
    )}`,
  );
}

async function ensureEligibleSubmission(
  submissionId: string,
) {
  const submission =
    await prisma.activityFormSubmission.findUnique({
      where: {
        id:
          submissionId,
      },

      select: {
        id: true,
        userId: true,
        studentName: true,
        status: true,
        checkedInAt:
          true,

        certificate: {
          select: {
            id: true,
            verificationCode:
              true,
            revokedAt:
              true,
          },
        },

        form: {
          select: {
            activity: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
    });

  if (
    !submission
  ) {
    certificateAdminError(
      "التسجيل غير موجود.",
    );
  }

  if (
    submission.status !==
    "APPROVED"
  ) {
    certificateAdminError(
      "لا يمكن إصدار شهادة إلا لتسجيل مقبول.",
    );
  }

  if (
    !submission.checkedInAt
  ) {
    certificateAdminError(
      "لا يمكن إصدار الشهادة قبل تسجيل حضور المشارك.",
    );
  }

  return submission;
}

async function uniqueCode() {
  for (
    let attempt = 0;
    attempt < 8;
    attempt += 1
  ) {
    const code =
      createVerificationCode();

    const exists =
      await prisma.certificate.findUnique({
        where: {
          verificationCode:
            code,
        },

        select: {
          id: true,
        },
      });

    if (!exists) {
      return code;
    }
  }

  throw new Error(
    "Could not generate a unique certificate code.",
  );
}

async function notifyCertificate(
  userId:
    | string
    | null,
  activityTitle: string,
  verificationCode: string,
) {
  if (!userId) {
    return;
  }

  await prisma.notification.create({
    data: {
      userId,

      type:
        "SYSTEM",

      title:
        "تم إصدار شهادتك",

      body:
        `تم إصدار شهادة مشاركتك في ${activityTitle}.`,

      href:
        `/certificates/${verificationCode}`,
    },
  });
}

export async function issueCertificate(
  formData: FormData,
) {
  await requirePermission(
    PERMISSIONS.ADMIN_DASHBOARD,
  );

  const submissionId =
    field(
      formData,
      "submissionId",
    );

  if (
    !submissionId
  ) {
    certificateAdminError(
      "التسجيل غير صالح.",
    );
  }

  const submission =
    await ensureEligibleSubmission(
      submissionId,
    );

  if (
    submission.certificate &&
    !submission.certificate
      .revokedAt
  ) {
    redirect(
      `/certificates/${submission.certificate.verificationCode}`,
    );
  }

  const code =
    submission.certificate
      ?.verificationCode ??
    await uniqueCode();

  let certificate;

  try {
    certificate =
      submission.certificate
        ? await prisma.certificate.update({
            where: {
              id:
                submission.certificate.id,
            },

            data: {
              revokedAt:
                null,

              issuedAt:
                new Date(),
            },
          })
        : await prisma.certificate.create({
            data: {
              submissionId:
                submission.id,

              verificationCode:
                code,
            },
          });
  } catch (
    error
  ) {
    if (
      error instanceof
        Prisma.PrismaClientKnownRequestError &&
      error.code ===
        "P2002"
    ) {
      certificateAdminError(
        "تعذر إنشاء كود فريد للشهادة. أعد المحاولة.",
      );
    }

    throw error;
  }

  await notifyCertificate(
    submission.userId,
    submission.form.activity.title,
    certificate.verificationCode,
  );

  revalidatePath(
    "/admin/certificates",
  );

  revalidatePath(
    "/notifications",
  );

  redirect(
    `/certificates/${certificate.verificationCode}`,
  );
}

export async function issueActivityCertificates(
  formData: FormData,
) {
  await requirePermission(
    PERMISSIONS.ADMIN_DASHBOARD,
  );

  const activityId =
    field(
      formData,
      "activityId",
    );

  if (
    !activityId
  ) {
    certificateAdminError(
      "اختر نشاطًا أولًا.",
    );
  }

  const submissions =
    await prisma.activityFormSubmission.findMany({
      where: {
        status:
          "APPROVED",

        checkedInAt: {
          not: null,
        },

        form: {
          activityId,
        },
      },

      select: {
        id: true,
        userId: true,

        certificate: {
          select: {
            id: true,
            verificationCode:
              true,
            revokedAt:
              true,
          },
        },

        form: {
          select: {
            activity: {
              select: {
                title: true,
              },
            },
          },
        },
      },
    });

  if (
    !submissions.length
  ) {
    certificateAdminError(
      "لا يوجد مشاركون مؤهلون لإصدار الشهادات في هذا النشاط.",
    );
  }

  let created =
    0;

  for (
    const submission
    of submissions
  ) {
    if (
      submission.certificate &&
      !submission.certificate
        .revokedAt
    ) {
      continue;
    }

    const code =
      submission.certificate
        ?.verificationCode ??
      await uniqueCode();

    const certificate =
      submission.certificate
        ? await prisma.certificate.update({
            where: {
              id:
                submission.certificate.id,
            },

            data: {
              revokedAt:
                null,

              issuedAt:
                new Date(),
            },
          })
        : await prisma.certificate.create({
            data: {
              submissionId:
                submission.id,

              verificationCode:
                code,
            },
          });

    await notifyCertificate(
      submission.userId,
      submission.form.activity.title,
      certificate.verificationCode,
    );

    created +=
      1;
  }

  revalidatePath(
    "/admin/certificates",
  );

  revalidatePath(
    "/notifications",
  );

  redirect(
    `/admin/certificates?activity=${encodeURIComponent(
      activityId,
    )}&success=${encodeURIComponent(
      `تم إصدار ${created} شهادة.`,
    )}`,
  );
}

export async function revokeCertificate(
  formData: FormData,
) {
  await requirePermission(
    PERMISSIONS.ADMIN_DASHBOARD,
  );

  const certificateId =
    field(
      formData,
      "certificateId",
    );

  if (
    !certificateId
  ) {
    certificateAdminError(
      "الشهادة غير صالحة.",
    );
  }

  const certificate =
    await prisma.certificate.findUnique({
      where: {
        id:
          certificateId,
      },

      select: {
        id: true,
        verificationCode:
          true,
      },
    });

  if (
    !certificate
  ) {
    certificateAdminError(
      "الشهادة غير موجودة.",
    );
  }

  await prisma.certificate.update({
    where: {
      id:
        certificate.id,
    },

    data: {
      revokedAt:
        new Date(),
    },
  });

  revalidatePath(
    "/admin/certificates",
  );

  revalidatePath(
    `/certificates/${certificate.verificationCode}`,
  );

  revalidatePath(
    `/certificates/verify/${certificate.verificationCode}`,
  );
}
