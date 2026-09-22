import { notFound } from "next/navigation";
import IndividualCertificateEditor from "@/components/admin/IndividualCertificateEditor";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { updateIndividualCertificate } from "../../actions";
import styles from "../../certificates.module.css";

export default async function EditCertificatePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission(PERMISSIONS.ADMIN_DASHBOARD);
  const { id } = await params;
  const certificate = await prisma.certificate.findUnique({
    where: { id },
    include: { submission: { include: { form: { include: { activity: { include: { certificateTemplate: true } } } } } } },
  });
  const template = certificate?.submission.form.activity.certificateTemplate;
  if (!certificate || certificate.revokedAt || !template) notFound();

  return <main className="admin-page">
    <div className={styles.pageHeading}><div><span>تعديل شهادة فردية</span><h1>{certificate.submission.studentName}</h1></div></div>
    <section className={styles.templatePanel}>
      <IndividualCertificateEditor
        certificateId={certificate.id}
        name={certificate.customName ?? certificate.submission.studentName}
        x={Number(certificate.customNameX ?? template.nameX)} y={Number(certificate.customNameY ?? template.nameY)}
        width={template.sourceWidth} height={template.sourceHeight}
        fontSize={Number(template.nameFontSize)} fontFamily={template.nameFontFamily}
        color={template.nameColor} align={template.nameAlign}
        templateUrl={`/admin/certificates/templates/${certificate.submission.form.activityId}`}
        action={updateIndividualCertificate}
      />
    </section>
  </main>;
}
