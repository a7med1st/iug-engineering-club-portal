import { randomUUID } from "node:crypto";
import type { CertificateTemplate, CertificateTemplateEnglish, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { putPrivateBlob, tryDeletePrivateBlobs } from "@/lib/blob-storage";
import { renderCertificate } from "@/lib/certificate-renderer";
import { CERTIFICATE_ENGLISH_FONTS, parseTemplateSettings, type CertificateFontFamily } from "@/lib/certificate-template-settings";
import { certificateNameError, certificateNamesFromAnswers, certificateOverrideLanguage } from "@/lib/certificate-names";

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
  if (!arabic && !english) throw new CertificateGenerationError("أرفق واحفظ قالب شهادة واحدًا على الأقل قبل الإصدار.");
  const names = certificateNamesFromAnswers(row.answers, row.studentName);
  const custom = overrides ?? row.certificate;
  const customLanguage = certificateOverrideLanguage(custom?.customName, arabic ? "ar" : "en");
  if (custom?.customName?.trim()) names[customLanguage] = custom.customName.trim();
  const englishError = english ? certificateNameError("en", names.en) : null;
  if (englishError) throw new CertificateGenerationError("اسم المشارك بالإنجليزية غير مكتمل في إجابات التسجيل. أكمل إجابة سؤال الاسم باللغة الإنجليزية قبل الإصدار.");
  const uploaded: string[] = [];
  const replaced: string[] = [];
  try {
    const data: Prisma.CertificateUpdateInput = { generatedAt: new Date(), ...overrides };
    for (const language of ["ar", "en"] as const) {
      const template = language === "ar" ? arabic : english;
      if (!template) continue;
      const settings = settingsForTemplate(template);
      if (language === customLanguage && custom) {
        settings.nameX = Number(custom.customNameX ?? settings.nameX);
        settings.nameY = Number(custom.customNameY ?? settings.nameY);
        settings.nameFontSize = Number(custom.customNameFontSize ?? settings.nameFontSize);
        if (language === "ar") settings.nameFontFamily = (custom.customNameFontFamily ?? settings.nameFontFamily) as CertificateFontFamily;
        else if (custom.customNameFontFamily && CERTIFICATE_ENGLISH_FONTS.includes(custom.customNameFontFamily as typeof CERTIFICATE_ENGLISH_FONTS[number])) settings.nameEnglishFontFamily = custom.customNameFontFamily as CertificateFontFamily;
        settings.nameBold = custom.customNameBold ?? settings.nameBold;
      }
      const rendered = await renderCertificate({ sourcePathname: template.sourcePathname, width: template.sourceWidth, height: template.sourceHeight, settings, studentName: names[language], activityTitle: activity.title, activityDate: activity.startsAt, qrSettings: template.qrSettings, verificationUrl, language });
      const pathname = `certificates/${certificateId}/${randomUUID()}-${language}.png`;
      uploaded.push(pathname);
      await putPrivateBlob(pathname, rendered.buffer, rendered.mime);
      if (language === "ar") {
        Object.assign(data, { artifactPathname: pathname, artifactMime: rendered.mime, artifactSize: rendered.size, artifactWidth: rendered.width, artifactHeight: rendered.height, templateFingerprint: rendered.fingerprint });
        if (row.certificate?.artifactPathname) replaced.push(row.certificate.artifactPathname);
      } else {
        Object.assign(data, { englishArtifactPathname: pathname, englishArtifactMime: rendered.mime, englishArtifactSize: rendered.size, englishArtifactWidth: rendered.width, englishArtifactHeight: rendered.height, englishTemplateFingerprint: rendered.fingerprint });
        if (row.certificate?.englishArtifactPathname) replaced.push(row.certificate.englishArtifactPathname);
      }
    }
    await prisma.certificate.update({ where: { id: certificateId }, data });
  } catch (error) {
    await tryDeletePrivateBlobs(uploaded, "bilingual-certificate-generation-rollback");
    throw error;
  }
  await tryDeletePrivateBlobs(replaced, "bilingual-certificate-replacement");
}
