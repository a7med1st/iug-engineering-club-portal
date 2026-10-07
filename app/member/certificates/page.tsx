import Link from "next/link";
import { ArrowRight } from "lucide-react";
import MyCertificates from "@/components/certificates/MyCertificates";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import styles from "@/app/student/certificates/certificates.module.css";

export const dynamic = "force-dynamic";

export default async function MemberCertificatesPage() {
  const { user } = await requirePermission(PERMISSIONS.MEMBER_DASHBOARD);
  return (
    <main>
      <nav className={styles.backNavigation} aria-label="العودة">
        <Link href="/member">
          <ArrowRight size={17} aria-hidden="true" />
          بوابة العضو
        </Link>
      </nav>
      <MyCertificates userId={user.id} />
    </main>
  );
}
