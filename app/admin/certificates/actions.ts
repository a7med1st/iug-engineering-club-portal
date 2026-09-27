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
  isIssuedCertificate,
} from "@/lib/certificates";

import {
  PERMISSIONS,
  requirePermission,
} from "@/lib/permissions";

import {
  prisma,
} from "@/lib/prisma";
import { renderCertificate } from "@/lib/certificate-renderer";
import { CERTIFICATE_FONTS, type CertificateFontFamily } from "@/lib/certificate-template-settings";
import { putPrivateBlob, tryDeletePrivateBlobs } from "@/lib/blob-storage";
import { randomUUID } from "node:crypto";

type IndividualOverrides = { customName: string; customNameX: number; customNameY: number; customNameFontSize: number; customNameFontFamily: CertificateFontFamily; customNameBold: boolean };

async function generateCertificateArtifact(submissionId: string, certificateId: string, overrides?: IndividualOverrides) {
  const row = await prisma.activityFormSubmission.findUnique({ where: { id: submissionId }, select: { studentName: true, form: { select: { activity: { select: { title: true, startsAt: true, certificateTemplate: true } } } }, certificate: { select: { artifactPathname: true, customName: true, customNameX: true, customNameY: true, customNameFontSize: true, customNameFontFamily: true, customNameBold: true } } } });
  const template = row?.form.activity.certificateTemplate;
  if (!row || !template) certificateAdminError("يجب إعداد قالب للنشاط قبل إصدار الشهادة.");
const rendered = await renderCertificate({ sourcePathname: template.sourcePathname, width: template.sourceWidth, height: template.sourceHeight, settings: { nameX:Number(overrides?.customNameX ?? row.certificate?.customNameX ?? template.nameX),nameY:Number(overrides?.customNameY ?? row.certificate?.customNameY ?? template.nameY),nameFontSize:Number(overrides?.customNameFontSize ?? row.certificate?.customNameFontSize ?? template.nameFontSize),nameFontFamily:(overrides?.customNameFontFamily ?? row.certificate?.customNameFontFamily ?? template.nameFontFamily) as CertificateFontFamily,nameEnglishFontFamily:template.nameEnglishFontFamily as "Cairo",nameBold:overrides?.customNameBold ?? row.certificate?.customNameBold ?? template.nameBold,nameColor:template.nameColor,nameAlign:template.nameAlign as "left"|"center"|"right",titleVisible:template.titleVisible,titleX:Number(template.titleX),titleY:Number(template.titleY),titleFontSize:Number(template.titleFontSize),titleFontFamily:template.titleFontFamily as "Cairo",titleEnglishFontFamily:template.titleEnglishFontFamily as "Cairo",titleBold:template.titleBold,titleColor:template.titleColor,titleAlign:template.titleAlign as "left"|"center"|"right",dateVisible:template.dateVisible,dateX:Number(template.dateX),dateY:Number(template.dateY),dateFontSize:Number(template.dateFontSize),dateFontFamily:template.dateFontFamily as "Cairo",dateEnglishFontFamily:template.dateEnglishFontFamily as "Cairo",dateBold:template.dateBold,dateColor:template.dateColor,dateAlign:template.dateAlign as "left"|"center"|"right" }, studentName: overrides?.customName.trim() || row.certificate?.customName?.trim() || row.studentName, activityTitle: row.form.activity.title, activityDate: row.form.activity.startsAt });
  const pathname=`certificates/${certificateId}/${randomUUID()}.png`; await putPrivateBlob(pathname,rendered.buffer,rendered.mime);
  try { await prisma.certificate.update({ where:{id:certificateId}, data:{artifactPathname:pathname,artifactMime:rendered.mime,artifactSize:rendered.size,artifactWidth:rendered.width,artifactHeight:rendered.height,generatedAt:new Date(),templateFingerprint:rendered.fingerprint,...overrides} }); } catch(error) { await tryDeletePrivateBlobs([pathname], "certificate-generation-rollback"); throw error; }
  if(row.certificate?.artifactPathname) await tryDeletePrivateBlobs([row.certificate.artifactPathname], "certificate-artifact-replacement");
}

function regenerationFailureMessage(error: unknown) {
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
          },
        },

        form: {
          select: {
            activity: {
              select: {
                id: true,
                title: true,
                certificateTemplate: { select: { id: true } },
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

  if (!submission.form.activity.certificateTemplate) {
    certificateAdminError("يجب إعداد قالب للنشاط قبل إصدار الشهادة.");
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

  if (submission.certificate && isIssuedCertificate(submission.certificate)) {
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
  if (!customName || customName.length > 160 || !Number.isFinite(customNameX) || !Number.isFinite(customNameY) || customNameX < 0 || customNameY < 0 || !Number.isFinite(customNameFontSize) || customNameFontSize < 1 || customNameFontSize > 512 || !CERTIFICATE_FONTS.some((font) => font === customNameFontFamily)) {
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
  if (!template) certificateAdminError("يجب إعداد قالب للنشاط قبل تحديث الشهادات.");

  const submissions = await prisma.activityFormSubmission.findMany({
    where: {
      form: { activityId },
      certificate: { is: { revokedAt: null } },
    },
    select: { id: true, certificate: { select: { id: true } } },
  });

  if (!submissions.length) {
    certificateAdminError("لا توجد شهادات صادرة لتحديثها في هذا النشاط.");
  }

  let failed = 0;
  for (const submission of submissions) {
    if (submission.certificate) {
      try {
        await generateCertificateArtifact(submission.id, submission.certificate.id);
      } catch (error) {
        failed += 1;
        console.error("Certificate bulk regeneration failed", { submissionId: submission.id, error });
      }
    }
  }

  revalidatePath("/admin/certificates");
  if (failed) {
    redirect(`/admin/certificates?activity=${encodeURIComponent(activityId)}&error=${encodeURIComponent(`تم تحديث ${submissions.length - failed} شهادة، وتعذر تحديث ${failed}. جرّب إعادة توليد الشهادات المتبقية فرديًا.`)}`);
  }
  redirect(
    `/admin/certificates?activity=${encodeURIComponent(activityId)}&success=${encodeURIComponent(
      `تم تحديث ${submissions.length} شهادة بالخط المحدد.`,
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
  if (!activityTemplate) {
    certificateAdminError("يجب إعداد قالب للنشاط قبل إصدار الشهادات.");
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
            artifactPathname: true,
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

  let created = 0;
  let failed = 0;

  for (
    const submission
    of submissions
  ) {
    if (isIssuedCertificate(submission.certificate)) {
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
    redirect(`/admin/certificates?activity=${encodeURIComponent(activityId)}&error=${encodeURIComponent(`تم إصدار ${created} شهادة، وتعذر إصدار ${failed}. حاول إصدار الشهادات المتبقية مجددًا.`)}`);
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
