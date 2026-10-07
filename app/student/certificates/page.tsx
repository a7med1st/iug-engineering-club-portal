import MyCertificates from "@/components/certificates/MyCertificates";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function StudentCertificatesPage() {
  const { user } = await requirePermission(PERMISSIONS.STUDENT_DASHBOARD);
  return <MyCertificates userId={user.id} />;
}
