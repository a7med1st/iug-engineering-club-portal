import { randomUUID } from "node:crypto";
import type { CertificateTemplate, CertificateTemplateEnglish } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { putPrivateBlob, tryDeletePrivateBlobs } from "@/lib/blob-storage";
import { renderCertificate } from "@/lib/certificate-renderer";
import { parseTemplateSettings, type CertificateFontFamily } from "@/lib/certificate-template-settings";
import { certificateNameError, certificateNamesFromAnswers } from "@/lib/certificate-names";

export type IndividualOverrides = { customName: string; customNameX: number; customNameY: number; customNameFontSize: number; customNameFontFamily: CertificateFontFamily; customNameBold: boolean };
export class CertificateGenerationError extends Error {}

function settingsForTemplate(template: CertificateTemplate | CertificateTemplateEnglish) {
  const data = new FormData();
  for (const [key, value] of Object.entries(template)) if (value !== null) data.set(key, typeof value === "boolean" ? (value ? "on" : "") : String(value));
  data.set("templateWidth", String(template.sourceWidth));
  data.set("templateHeight", String(template.sourceHeight));
  const parsed = parseTemplateSettings(data);
  if (!parsed.ok) throw new CertificateGenerationError(parsed.message);
  return parsed.value;
}

export async function generateBilingualCertificateArtifacts(submissionId: string, certificateId: string, verificationUrl: string, overrides?: IndividualOverrides) {
  const row = await prisma.activityFormSubmission.findUniqueOrThrow({
    where: { id: submissionId },
    include: { answers: { include: { question: { select: { label: true } } } }, form: { include: { activity: { include: { certificateTemplate: true, certificateTemplateEnglish: true } } } }, certificate: true },
  });
  const activity = row.form.activity;
  const arabic = activity.certificateTemplate;
  const english = activity.certificateTemplateEnglish;
  if (!arabic || !english) throw new CertificateGenerationError("أرفق واحفظ قالب الشهادة العربية وقالب الشهادة الإنجليزية قبل إصدار النسختين.");
  const names = certificateNamesFromAnswers(row.answers, row.studentName);
  names.ar = overrides?.customName.trim() || row.certificate?.customName?.trim() || names.ar;
  const englishError = certificateNameError("en", names.en);
  if (englishError) throw new CertificateGenerationError("اسم المشارك بالإنجليزية غير مكتمل في إجابات التسجيل. أكمل إجابة سؤال الاسم باللغة الإنجليزية قبل الإصدار.");
  const arabicSettings = settingsForTemplate(arabic);
  const custom = overrides ?? row.certificate;
  if (custom) {
    arabicSettings.nameX = Number(custom.customNameX ?? arabicSettings.nameX);
    arabicSettings.nameY = Number(custom.customNameY ?? arabicSettings.nameY);
    arabicSettings.nameFontSize = Number(custom.customNameFontSize ?? arabicSettings.nameFontSize);
    arabicSettings.nameFontFamily = (custom.customNameFontFamily ?? arabicSettings.nameFontFamily) as CertificateFontFamily;
    arabicSettings.nameBold = custom.customNameBold ?? arabicSettings.nameBold;
  }
  const uploaded: string[] = [];
  try {
    const ar = await renderCertificate({ sourcePathname: arabic.sourcePathname, width: arabic.sourceWidth, height: arabic.sourceHeight, settings: arabicSettings, studentName: names.ar, activityTitle: activity.title, activityDate: activity.startsAt, qrSettings: arabic.qrSettings, verificationUrl });
    const en = await renderCertificate({ sourcePathname: english.sourcePathname, width: english.sourceWidth, height: english.sourceHeight, settings: settingsForTemplate(english), studentName: names.en, activityTitle: activity.title, activityDate: activity.startsAt, qrSettings: english.qrSettings, verificationUrl, language: "en" });
    const arPath = `certificates/${certificateId}/${randomUUID()}-ar.png`;
    const enPath = `certificates/${certificateId}/${randomUUID()}-en.png`;
    uploaded.push(arPath);
    await putPrivateBlob(arPath, ar.buffer, ar.mime);
    uploaded.push(enPath);
    await putPrivateBlob(enPath, en.buffer, en.mime);
    await prisma.certificate.update({ where: { id: certificateId }, data: {
      artifactPathname: arPath, artifactMime: ar.mime, artifactSize: ar.size, artifactWidth: ar.width, artifactHeight: ar.height, templateFingerprint: ar.fingerprint,
      englishArtifactPathname: enPath, englishArtifactMime: en.mime, englishArtifactSize: en.size, englishArtifactWidth: en.width, englishArtifactHeight: en.height, englishTemplateFingerprint: en.fingerprint,
      generatedAt: new Date(), ...overrides,
    } });
  } catch (error) {
    await tryDeletePrivateBlobs(uploaded, "bilingual-certificate-generation-rollback");
    throw error;
  }
  await tryDeletePrivateBlobs([row.certificate?.artifactPathname, row.certificate?.englishArtifactPathname].filter((value): value is string => Boolean(value)), "bilingual-certificate-replacement");
}
