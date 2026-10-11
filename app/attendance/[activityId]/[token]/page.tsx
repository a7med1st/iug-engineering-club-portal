import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { CalendarDays, CheckCircle2, ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { loadAttendanceConfirmation } from "@/lib/attendance-confirmation";
import { confirmSelfAttendance } from "./actions";
import { attendanceDeps } from "@/lib/attendance-prisma";
import styles from "./attendance.module.css";

export const dynamic = "force-dynamic";

const messages: Record<string, string> = {
  INVALID_LINK: "رابط الحضور غير صالح.", LINK_DISABLED: "رابط الحضور متوقف حاليًا.", NOT_OPEN: "لم يبدأ وقت تسجيل الحضور بعد.", EXPIRED: "انتهت صلاحية رابط الحضور.", WRONG_ROLE: "تسجيل الحضور متاح لحسابات الطلاب فقط.", NOT_REGISTERED: "أنت غير مسجل في هذا النشاط.", PENDING_REGISTRATION: "طلب تسجيلك ما زال قيد المراجعة.", REJECTED_REGISTRATION: "تسجيلك في هذا النشاط غير مقبول.", ALREADY_RECORDED: "تم تسجيل حضورك مسبقًا.",
};

export default async function AttendancePage({ params, searchParams }: { params: Promise<{ activityId: string; token: string }>; searchParams: Promise<{ result?: string }> }) {
  const { activityId, token } = await params;
  const query = await searchParams;
  const auth = await getCurrentUser();
  const state = await loadAttendanceConfirmation({ activityId, token, user: auth ? { id: auth.user.id, role: auth.user.role, name: auth.user.name } : null }, attendanceDeps());
  const path = `/attendance/${activityId}/${token}`;
  if (state.status === "LOGIN_REQUIRED") redirect(`/login?portal=student&returnTo=${encodeURIComponent(path)}`);
  const successful = state.status === "ALREADY_RECORDED";
  return <main className={styles.page} dir="rtl"><section className={styles.panel}>
    <header className={styles.header}>
      <div className={styles.icon}>{successful ? <CheckCircle2 /> : <ShieldCheck />}</div>
      <h1>{successful ? "تم تسجيل حضورك" : "تأكيد الحضور"}</h1>
      <Image className={styles.clubLogo} src="/images/club-logo.png" alt="شعار النادي الهندسي" width={88} height={88} />
    </header>
    {"activity" in state && state.activity && <div className={styles.details}><span className={styles.label}>النشاط</span><p className={styles.activityTitle}>{state.activity.title}</p>
      {"session" in state && state.session && <div className={styles.session}><span className={styles.label}>الجلسة</span><h2>{state.session.title}</h2></div>}
      <p className={styles.date}><CalendarDays size={18} /> {state.activity.startsAt ? new Intl.DateTimeFormat("ar-PS", { dateStyle: "long" }).format(state.activity.startsAt) : "الموعد غير محدد"}</p></div>}
    {state.status === "READY" && !successful ? <><strong className={styles.student}>{state.submission.studentName}</strong><form action={confirmSelfAttendance}><input type="hidden" name="activityId" value={activityId}/><input type="hidden" name="token" value={token}/><button type="submit">تأكيد حضوري</button></form></> : <p className={styles.message} role="status">{successful ? (query.result === "already" ? "حضورك في هذه الجلسة مسجل مسبقًا." : "تم حفظ حضورك في هذه الجلسة بنجاح.") : messages[state.status]}</p>}
    {state.status === "NOT_REGISTERED" && <Link href={`/activities/${activityId}/register?returnTo=${encodeURIComponent(path)}`}>التسجيل في النشاط</Link>}
    <Link className={styles.cancel} href="/student">العودة للوحة الطالب</Link>
  </section></main>;
}
