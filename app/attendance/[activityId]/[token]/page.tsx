import Link from "next/link";
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
  const successful = query.result === "success" || query.result === "already";
  return <main className={styles.page} dir="rtl"><section className={styles.panel}>
    <div className={styles.icon}>{successful ? <CheckCircle2 /> : <ShieldCheck />}</div>
    <h1>{successful ? "تم تسجيل حضورك" : "تأكيد الحضور"}</h1>
    {"activity" in state && state.activity && <><h2>{state.activity.title}</h2><p><CalendarDays size={18} /> {state.activity.startsAt ? new Intl.DateTimeFormat("ar-PS", { dateStyle: "long" }).format(state.activity.startsAt) : "الموعد غير محدد"}</p></>}
    {state.status === "READY" && !successful ? <><strong>{state.submission.studentName}</strong><form action={confirmSelfAttendance}><input type="hidden" name="activityId" value={activityId}/><input type="hidden" name="token" value={token}/><button type="submit">تأكيد حضوري</button></form></> : <p>{successful ? (query.result === "already" ? "حضورك مسجل مسبقًا." : "تم حفظ حضورك بنجاح.") : messages[state.status]}</p>}
    {state.status === "NOT_REGISTERED" && <Link href={`/activities/${activityId}/register?returnTo=${encodeURIComponent(path)}`}>التسجيل في النشاط</Link>}
    <Link className={styles.cancel} href="/student">العودة للوحة الطالب</Link>
  </section></main>;
}
