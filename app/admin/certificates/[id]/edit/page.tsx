import { notFound } from "next/navigation";
import IndividualCertificateEditor from "@/components/admin/IndividualCertificateEditor";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { updateIndividualCertificate } from "../../actions";
import styles from "../../certificates.module.css";
import { certificateNamesFromAnswers, certificateOverrideLanguage } from "@/lib/certificate-names";

export default async function EditCertificatePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission(PERMISSIONS.ADMIN_DASHBOARD);
  const { id } = await params;
  const certificate = await prisma.certificate.findUnique({
    where: { id },
    include: { submission: { include: { answers: { include: { question: { select: { label: true } } } }, form: { include: { activity: { include: { certificateTemplate: true, certificateTemplateEnglish: true } } } } } } },
  });
  const activity = certificate?.submission.form.activity;
  const template = activity?.certificateTemplate ?? activity?.certificateTemplateEnglish;
  if (!certificate || certificate.revokedAt || !template) notFound();
  const language = activity?.certificateTemplate ? "ar" : "en";
  const names = certificateNamesFromAnswers(certificate.submission.answers, certificate.submission.studentName);
  const hasOverride = certificateOverrideLanguage(certificate.customName, language) === language;

  return <main className="admin-page">
    <div className={styles.pageHeading}><div><span>تعديل شهادة فردية</span><h1>{certificate.submission.studentName}</h1></div></div>
    <section className={styles.templatePanel}>
      <IndividualCertificateEditor
        certificateId={certificate.id}
        language={language}
        name={hasOverride ? certificate.customName ?? names[language] : names[language]}
        x={Number((hasOverride ? certificate.customNameX : null) ?? template.nameX)} y={Number((hasOverride ? certificate.customNameY : null) ?? template.nameY)}
        width={template.sourceWidth} height={template.sourceHeight}
        fontSize={Number((hasOverride ? certificate.customNameFontSize : null) ?? template.nameFontSize)} bold={(hasOverride ? certificate.customNameBold : null) ?? template.nameBold} fontFamily={(hasOverride ? certificate.customNameFontFamily : null) ?? (language === "en" ? template.nameEnglishFontFamily : template.nameFontFamily)}
        color={template.nameColor} align={template.nameAlign}
        templateUrl={`/admin/certificates/templates/${certificate.submission.form.activityId}?language=${language}`}
        action={updateIndividualCertificate}
      />
    </section>
  </main>;
}
