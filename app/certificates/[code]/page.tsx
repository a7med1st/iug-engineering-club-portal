import { Download, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import PrintButton from "@/components/admin/PrintButton";
import { getCurrentUser } from "@/lib/auth";
import { getCertificateByCode } from "@/lib/certificates";
import styles from "./certificate.module.css";

export const dynamic="force-dynamic";

export default async function CertificatePage({params}:{params:Promise<{code:string}>}){
  const{code}=await params;const certificate=await getCertificateByCode(code);const auth=await getCurrentUser();
  if(!certificate||!auth||(auth.user.role!=="ADMIN"&&certificate.submission.userId!==auth.user.id)||certificate.revokedAt||certificate.submission.status!=="APPROVED"||!certificate.submission.checkedInAt||!certificate.artifactPathname)notFound();
  const imageUrl=`/certificates/${certificate.verificationCode}/download?inline=1`;
  return <main className={styles.shell} dir="rtl">
    <div className={styles.toolbar}>
      <PrintButton/>
      <Link className={styles.verifyLink} href={`/certificates/verify/${certificate.verificationCode}`}><ShieldCheck size={17}/>التحقق من الشهادة</Link>
      <Link className={styles.downloadLink} href={`/certificates/${certificate.verificationCode}/download`}><Download size={17}/>تنزيل PNG</Link>
    </div>
    <figure className={styles.certificate} style={{aspectRatio:`${certificate.artifactWidth??1}/${certificate.artifactHeight??1}`}}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt={`شهادة ${certificate.submission.studentName}`}/>
    </figure>
  </main>;
}
