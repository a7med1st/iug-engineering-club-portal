import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import sharp from "sharp";

async function main() {
  loadEnvConfig(process.cwd());
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(process.env.DATABASE_URL!).hostname), "Use the local test database");
  const storageRoot = await mkdtemp(path.join(os.tmpdir(), "optional-certificate-tests-"));
  process.env.FILE_STORAGE_DRIVER = "local";
  process.env.LOCAL_STORAGE_ROOT = storageRoot;
  const { prisma } = await import("../lib/prisma");
  const { putPrivateBlob, getPrivateBlob } = await import("../lib/blob-storage");
  const { generateBilingualCertificateArtifacts } = await import("../lib/bilingual-certificate-artifacts");
  const { isCertificateValid, hasIssuedCertificateLanguages } = await import("../lib/certificates");
  const { certificateDownloadLanguage } = await import("../lib/certificate-language");
  const { CERTIFICATE_NAME_QUESTIONS } = await import("../lib/certificate-names");
  const fixtures: string[] = [];
  try {
    for (const mode of ["ar", "en", "both"] as const) {
      const activity = await prisma.activity.create({ data: { title: `Optional certificate test ${randomUUID()}`, description: "Isolated certificate fixture", location: "Test", capacity: 1, registrationForm: { create: { title: "Test", opensAt: new Date(), closesAt: new Date(Date.now() + 86400000), questions: { create: (["ar", "en"] as const).map((language, sortOrder) => ({ label: mode === "en" ? (language === "en" ? "اسم الطالب ثلاثي باللغة الإنجليزية" : "اسم الطالب ثلاثي باللغة العربية") : CERTIFICATE_NAME_QUESTIONS[language].label, type: "SHORT_TEXT", required: true, sortOrder })) } } } }, include: { registrationForm: { include: { questions: true } } } });
      fixtures.push(activity.id);
      for (const language of ["ar", "en"] as const) {
        if (mode !== "both" && mode !== language) continue;
        const width = language === "ar" ? 1200 : 1000;
        const height = language === "ar" ? 850 : 700;
        const buffer = await sharp({ create: { width, height, channels: 3, background: "white" } }).png().toBuffer();
        const sourcePathname = `test-templates/${randomUUID()}.png`;
        await putPrivateBlob(sourcePathname, buffer, "image/png");
        const data = { activityId: activity.id, sourcePathname, sourceOriginalName: `${language}.png`, sourceMime: "image/png", sourceSize: buffer.length, sourceWidth: width, sourceHeight: height };
        if (language === "ar") await prisma.certificateTemplate.create({ data });
        else await prisma.certificateTemplateEnglish.create({ data });
      }
      const form = activity.registrationForm!;
      const submission = await prisma.activityFormSubmission.create({ data: { formId: form.id, studentName: "اسم الحساب", studentEmail: "certificate-test@example.com", studentDepartment: "Test", status: "APPROVED", checkedInAt: new Date(), answers: { create: form.questions.filter(q => mode !== "ar" || q.sortOrder === 0).map(q => ({ questionId: q.id, value: q.sortOrder === 0 ? "أحمد محمد" : "Ahmad Mohammed" })) } } });
      const certificate = await prisma.certificate.create({ data: { submissionId: submission.id, verificationCode: `EC-TEST-${randomUUID()}`.toUpperCase() } });
      await generateBilingualCertificateArtifacts(submission.id, certificate.id, `https://example.com/certificates/verify/${certificate.verificationCode}`);
      const result = await prisma.certificate.findUniqueOrThrow({ where: { id: certificate.id } });
      assert.equal(Boolean(result.artifactPathname), mode !== "en");
      assert.equal(Boolean(result.englishArtifactPathname), mode !== "ar");
      assert.equal(isCertificateValid({ ...result, submission }), true);
      assert.equal(hasIssuedCertificateLanguages(result, { ar: mode !== "en", en: mode !== "ar" }), true);
      assert.equal(certificateDownloadLanguage(null, result), mode === "en" ? "en" : "ar");
      for (const language of ["ar", "en"] as const) {
        const pathname = language === "ar" ? result.artifactPathname : result.englishArtifactPathname;
        if (!pathname) continue;
        const stored = await getPrivateBlob(pathname);
        assert.ok(stored?.stream);
        const metadata = await sharp(Buffer.from(await new Response(stored.stream).arrayBuffer())).metadata();
        assert.equal(metadata.width, language === "ar" ? 1200 : 1000);
      }
      assert.equal(isCertificateValid({ ...result, revokedAt: new Date(), submission }), false);
      console.log(`PASS: ${mode} template generation, available languages, default download and revocation`);
    }
  } finally {
    for (const id of fixtures) {
      await prisma.activityFormSubmission.deleteMany({ where: { form: { activityId: id } } });
      await prisma.activity.delete({ where: { id } });
    }
    await prisma.$disconnect();
    const relative = path.relative(os.tmpdir(), storageRoot);
    assert.ok(relative.startsWith("optional-certificate-tests-") && !relative.includes(path.sep));
    await rm(storageRoot, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
