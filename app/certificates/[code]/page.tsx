import { Download, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import PrintButton from "@/components/admin/PrintButton";
import { getCurrentUser } from "@/lib/auth";
import { canViewCertificate, getCertificateByCode, isCertificateValid } from "@/lib/certificates";
import styles from "./certificate.module.css";
import { certificateDownloadLanguage } from "@/lib/certificate-language";

export const dynamic="force-dynamic";

export default async function CertificatePage({params,searchParams}:{params:Promise<{code:string}>;searchParams:Promise<{language?:string}>}){
  const{code}=await params;const certificate=await getCertificateByCode(code);const auth=await getCurrentUser();
  if(!certificate||!auth||!canViewCertificate(auth.user,certificate.submission.userId)||!isCertificateValid(certificate))notFound();
  const language=certificateDownloadLanguage((await searchParams).language ?? null, certificate);
  if(!language)notFound();
  if(language === "ar" && !certificate.artifactPathname)notFound();
  if(language === "en" && !certificate.englishArtifactPathname)notFound();
  const imageUrl=`/certificates/${certificate.verificationCode}/download?inline=1&language=${language}`;
  return <main className={styles.shell} dir="rtl">
    <div className={styles.toolbar}>
      <PrintButton/>
      <Link className={styles.verifyLink} href={`/certificates/verify/${certificate.verificationCode}`}><ShieldCheck size={17}/>التحقق من الشهادة</Link>
      {certificate.artifactPathname && <Link className={styles.verifyLink} href={`/certificates/${certificate.verificationCode}?language=ar`} aria-current={language === "ar" ? "page" : undefined}>العربية</Link>}
      {certificate.englishArtifactPathname && <Link className={styles.verifyLink} href={`/certificates/${certificate.verificationCode}?language=en`} aria-current={language === "en" ? "page" : undefined}>English</Link>}
      {certificate.artifactPathname && <Link className={styles.downloadLink} href={`/certificates/${certificate.verificationCode}/download?language=ar`}><Download size={17}/>تنزيل العربية</Link>}
      {certificate.englishArtifactPathname && <Link className={styles.downloadLink} href={`/certificates/${certificate.verificationCode}/download?language=en`}><Download size={17}/>تنزيل الإنجليزية</Link>}
    </div>
    <figure className={styles.certificate} style={{aspectRatio:language === "en" ? `${certificate.englishArtifactWidth??1}/${certificate.englishArtifactHeight??1}` : `${certificate.artifactWidth??1}/${certificate.artifactHeight??1}`}}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt={`شهادة ${certificate.submission.studentName}`}/>
    </figure>
  </main>;
}
