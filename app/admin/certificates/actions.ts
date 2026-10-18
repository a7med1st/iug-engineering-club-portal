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
  hasIssuedCertificateLanguages,
} from "@/lib/certificates";

import {
  PERMISSIONS,
  requirePermission,
} from "@/lib/permissions";

import {
  prisma,
} from "@/lib/prisma";
import { CertificateGenerationError, generateBilingualCertificateArtifacts, type IndividualOverrides } from "@/lib/bilingual-certificate-artifacts";
import { headers } from "next/headers";
import { CERTIFICATE_FONTS, CERTIFICATE_ENGLISH_FONTS, type CertificateFontFamily } from "@/lib/certificate-template-settings";
import { getAttendanceProgress } from "@/lib/activity-attendance";

async function generateCertificateArtifact(submissionId: string, certificateId: string, overrides?: IndividualOverrides) {
  const certificate = await prisma.certificate.findUniqueOrThrow({ where: { id: certificateId }, select: { verificationCode: true } });
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!host) throw new Error("CERTIFICATE_HOST_MISSING");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  await generateBilingualCertificateArtifacts(submissionId, certificateId, `${protocol}://${host}/certificates/verify/${encodeURIComponent(certificate.verificationCode)}`, overrides);
}

function regenerationFailureMessage(error: unknown) {
  if (error instanceof CertificateGenerationError) return error.message;
  if (error instanceof Error && error.message === "CERTIFICATE_NAME_NOT_VISIBLE:no_visible_characters") {
    return "اسم المشارك لا يحتوي أحرفًا ظاهرة. تحقق من الاسم المسجل أو عدّله في إعدادات الشهادة.";
  }
  return error instanceof Error && error.message.startsWith("CERTIFICATE_NAME_NOT_VISIBLE")
    ? "تعذر إظهار الاسم داخل القالب. تحقق من موضع الاسم وحجم الخط في إعدادات الشهادة."
    : "تعذر توليد صورة الشهادة. حاول مجددًا، وإن استمرت المشكلة راجع سجل الخادم.";
}

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
        sessionAttendances: { select: { sessionId: true } },
        checkedInAt:
          true,

        certificate: {
          select: {
            id: true,
            verificationCode:
              true,
            revokedAt:
              true,
            artifactPathname: true,
            englishArtifactPathname: true,
          },
        },

        form: {
          select: {
            activity: {
              select: {
                id: true,
                title: true,
                certificateTemplate: { select: { id: true } },
                certificateTemplateEnglish: { select: { id: true } },
                requiredAttendanceCount: true,
                sessions: { select: { id: true } },
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

  const progress = getAttendanceProgress(submission);
  if (!progress.eligible) {
    certificateAdminError(`لا يمكن إصدار أو إعادة توليد الشهادة: حضر المشارك ${progress.attendanceCount} جلسة، والمطلوب ${progress.requiredAttendanceCount} جلسة.`);
  }

  if (!submission.form.activity.certificateTemplate && !submission.form.activity.certificateTemplateEnglish) {
    certificateAdminError("احفظ قالب شهادة واحدًا على الأقل قبل الإصدار.");
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

  try { await prisma.notification.create({
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
  }); } catch (error) {
    console.error("Certificate notification failed", { userId, verificationCode, error });
  }
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

  if (submission.certificate && hasIssuedCertificateLanguages(submission.certificate, { ar: Boolean(submission.form.activity.certificateTemplate), en: Boolean(submission.form.activity.certificateTemplateEnglish) })) {
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
        ? submission.certificate
        : await prisma.certificate.create({
            data: {
              submissionId:
                submission.id,

              verificationCode:
                code,
              revokedAt: new Date(),
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

  try {
    await generateCertificateArtifact(submission.id, certificate.id);
    await prisma.certificate.update({ where: { id: certificate.id }, data: { revokedAt: null, issuedAt: new Date() } });
  } catch (error) {
    console.error("Certificate issuance failed", { submissionId: submission.id, error });
    redirect(`/admin/certificates?activity=${encodeURIComponent(submission.form.activity.id)}&error=${encodeURIComponent(regenerationFailureMessage(error))}`);
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

export async function regenerateCertificate(formData: FormData) {
  await requirePermission(PERMISSIONS.ADMIN_DASHBOARD);

  const submissionId = field(formData, "submissionId");
  if (!submissionId) certificateAdminError("التسجيل غير صالح.");

  const submission = await ensureEligibleSubmission(submissionId);
  if (!submission.certificate || submission.certificate.revokedAt) {
    certificateAdminError("الشهادة غير متاحة لإعادة التوليد.");
  }

  try {
    await generateCertificateArtifact(submission.id, submission.certificate.id);
  } catch (error) {
    console.error("Certificate regeneration failed", { submissionId: submission.id, error });
    redirect(`/admin/certificates?activity=${encodeURIComponent(submission.form.activity.id)}&error=${encodeURIComponent(regenerationFailureMessage(error))}`);
  }
  revalidatePath("/admin/certificates");
  redirect(`/admin/certificates?success=${encodeURIComponent("تم تحديث صورة الشهادة.")}`);
}

export async function updateIndividualCertificate(formData: FormData) {
  await requirePermission(PERMISSIONS.ADMIN_DASHBOARD);

  const certificateId = field(formData, "certificateId");
  const customName = field(formData, "customName");
  const customNameX = Number(formData.get("customNameX"));
  const customNameY = Number(formData.get("customNameY"));
  const customNameFontSize = Number(formData.get("customNameFontSize"));
  const customNameFontFamily = field(formData, "customNameFontFamily");
  const customNameBold = formData.get("customNameBold") === "on";

  const certificate = await prisma.certificate.findUnique({
    where: { id: certificateId },
    select: {
      id: true,
      revokedAt: true,
      submissionId: true,
      submission: { select: { form: { select: { activityId: true } } } },
    },
  });

  if (!certificate || certificate.revokedAt) certificateAdminError("الشهادة غير متاحة للتعديل.");
  await ensureEligibleSubmission(certificate.submissionId);
  if (!customName || customName.length > 160 || !Number.isFinite(customNameX) || !Number.isFinite(customNameY) || customNameX < 0 || customNameY < 0 || !Number.isFinite(customNameFontSize) || customNameFontSize < 1 || customNameFontSize > 512 || ![...CERTIFICATE_FONTS, ...CERTIFICATE_ENGLISH_FONTS].some((font) => font === customNameFontFamily)) {
    certificateAdminError("تحقق من الاسم وموقعه داخل الشهادة.");
  }

  try {
    await generateCertificateArtifact(certificate.submissionId, certificate.id, { customName, customNameX, customNameY, customNameFontSize, customNameFontFamily: customNameFontFamily as CertificateFontFamily, customNameBold });
  } catch (error) {
    console.error("Individual certificate update failed", { certificateId: certificate.id, error });
    redirect(`/admin/certificates?activity=${encodeURIComponent(certificate.submission.form.activityId)}&error=${encodeURIComponent(regenerationFailureMessage(error))}`);
  }

  revalidatePath("/admin/certificates");
  redirect(`/admin/certificates?activity=${encodeURIComponent(certificate.submission.form.activityId)}&success=${encodeURIComponent("تم تعديل الشهادة وإعادة توليدها.")}`);
}

export async function regenerateActivityCertificates(formData: FormData) {
  await requirePermission(PERMISSIONS.ADMIN_DASHBOARD);

  const activityId = field(formData, "activityId");
  if (!activityId) certificateAdminError("اختر نشاطًا أولًا.");

  const template = await prisma.certificateTemplate.findUnique({
    where: { activityId },
    select: { id: true },
  });
  const englishTemplate = await prisma.certificateTemplateEnglish.findUnique({ where: { activityId }, select: { id: true } });
  if (!template && !englishTemplate) certificateAdminError("احفظ قالب شهادة واحدًا على الأقل قبل التحديث.");

  const submissions = await prisma.activityFormSubmission.findMany({
    where: {
      form: { activityId },
      certificate: { is: { revokedAt: null } },
    },
    select: {
      id: true,
      status: true,
      checkedInAt: true,
      sessionAttendances: { select: { sessionId: true } },
      form: { select: { activity: { select: { requiredAttendanceCount: true, sessions: { select: { id: true } } } } } },
      certificate: { select: { id: true } },
    },
  });

  if (!submissions.length) {
    certificateAdminError("لا توجد شهادات صادرة لتحديثها في هذا النشاط.");
  }

  let failed = 0;
  let regenerated = 0;
  const failureReasons = new Set<string>();
  for (const submission of submissions) {
    if (!getAttendanceProgress(submission).eligible) continue;
    if (submission.certificate) {
      try {
        await generateCertificateArtifact(submission.id, submission.certificate.id);
        regenerated += 1;
      } catch (error) {
        failed += 1;
        failureReasons.add(regenerationFailureMessage(error));
        console.error("Certificate bulk regeneration failed", { submissionId: submission.id, error });
      }
    }
  }

  revalidatePath("/admin/certificates");
  if (failed) {
    redirect(`/admin/certificates?activity=${encodeURIComponent(activityId)}&error=${encodeURIComponent(`تم تحديث ${regenerated} شهادة، وتعذر تحديث ${failed}. ${[...failureReasons].slice(0, 3).join(" ")}`)}`);
  }
  redirect(
    `/admin/certificates?activity=${encodeURIComponent(activityId)}&success=${encodeURIComponent(
      `تم تحديث ${regenerated} شهادة بالخط المحدد.`,
    )}`,
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

  const activityTemplate = await prisma.certificateTemplate.findUnique({
    where: { activityId },
    select: { id: true },
  });
  const englishTemplate = await prisma.certificateTemplateEnglish.findUnique({ where: { activityId }, select: { id: true } });
  if (!activityTemplate && !englishTemplate) {
    certificateAdminError("احفظ قالب شهادة واحدًا على الأقل قبل الإصدار.");
  }

  const submissions =
    await prisma.activityFormSubmission.findMany({
      where: {
        status:
          "APPROVED",

        form: {
          activityId,
        },
      },

      select: {
        id: true,
        userId: true,

        status: true,
        checkedInAt: true,
        sessionAttendances: { select: { sessionId: true } },

        certificate: {
          select: {
            id: true,
            verificationCode:
              true,
            revokedAt:
              true,
            artifactPathname: true,
            englishArtifactPathname: true,
          },
        },

        form: {
          select: {
            activity: {
              select: {
                title: true,
                requiredAttendanceCount: true,
                sessions: { select: { id: true } },
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

  let created = 0;
  let failed = 0;
  const failureReasons = new Set<string>();

  for (
    const submission
    of submissions
  ) {
    if (!getAttendanceProgress(submission).eligible) continue;
    if (hasIssuedCertificateLanguages(submission.certificate, { ar: Boolean(activityTemplate), en: Boolean(englishTemplate) })) {
      continue;
    }

    const code =
      submission.certificate
        ?.verificationCode ??
      await uniqueCode();

    const certificate =
      submission.certificate
        ? submission.certificate
        : await prisma.certificate.create({
            data: {
              submissionId:
                submission.id,

              verificationCode:
                code,
              revokedAt: new Date(),
            },
          });

    try {
      await generateCertificateArtifact(submission.id, certificate.id);
      await prisma.certificate.update({ where: { id: certificate.id }, data: { revokedAt: null, issuedAt: new Date() } });
    } catch (error) {
      failed += 1;
      failureReasons.add(regenerationFailureMessage(error));
      console.error("Certificate bulk issuance failed", { submissionId: submission.id, error });
      continue;
    }

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

  if (failed) {
    redirect(`/admin/certificates?activity=${encodeURIComponent(activityId)}&error=${encodeURIComponent(`تم إصدار ${created} شهادة، وتعذر إصدار ${failed}. ${[...failureReasons].slice(0, 3).join(" ")}`)}`);
  }

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
