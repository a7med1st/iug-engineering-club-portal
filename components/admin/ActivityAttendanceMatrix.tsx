import { Check, Minus } from "lucide-react";
import { getAttendanceProgress } from "@/lib/activity-attendance";
import styles from "./ActivityAttendanceMatrix.module.css";

type Session = { id: string; title: string };
type Submission = { id: string; studentName: string; status: string; checkedInAt: Date | null; sessionAttendances: { sessionId: string }[] };
export default function ActivityAttendanceMatrix({ activityId, sessions, requiredAttendanceCount, submissions, canManage, action }: {
  activityId: string; sessions: Session[]; requiredAttendanceCount: number; submissions: Submission[]; canManage: boolean; action: (form: FormData) => Promise<void>;
}) {
  function toggle(submission: Submission, session: Session) {
    const present = submission.sessionAttendances.some(row => row.sessionId === session.id);
    return <form action={action}>
      <input type="hidden" name="activityId" value={activityId} />
      <input type="hidden" name="submissionId" value={submission.id} />
      <input type="hidden" name="sessionId" value={session.id} />
      <input type="hidden" name="attendanceAction" value={present ? "CHECK_OUT" : "CHECK_IN"} />
      <button className={present ? styles.present : styles.absent} disabled={!canManage || submission.status !== "APPROVED"} aria-label={`${submission.studentName}، ${session.title}: ${present ? "إلغاء الحضور" : "تسجيل الحضور"}`} title={present ? "إلغاء الحضور" : "تسجيل الحضور"} aria-pressed={present}>{present ? <Check size={18} /> : <Minus size={18} />}</button>
    </form>;
  }
  function progress(submission: Submission) {
    const result = getAttendanceProgress({ ...submission, form: { activity: { sessions, requiredAttendanceCount } } });
    return <span>{result.attendanceCount} / {result.requiredAttendanceCount} · {result.eligible ? "مستحق" : "غير مستحق"}</span>;
  }
  return <section className={styles.matrix}>
    <h2>حضور الجلسات</h2>
    <div className={styles.desktop}><table><thead><tr><th scope="col">الطالب</th>{sessions.map(session => <th key={session.id} scope="col">{session.title}</th>)}<th scope="col">الاستحقاق</th></tr></thead><tbody>{submissions.map(submission => <tr key={submission.id}><th scope="row">{submission.studentName}</th>{sessions.map(session => <td key={session.id}>{toggle(submission, session)}</td>)}<td>{progress(submission)}</td></tr>)}</tbody></table></div>
    <div className={styles.mobile}>{submissions.map(submission => <article key={submission.id}><h3>{submission.studentName}</h3><p>{progress(submission)}</p>{sessions.map(session => <div className={styles.mobileRow} key={session.id}><span>{session.title}</span>{toggle(submission, session)}</div>)}</article>)}</div>
    {!submissions.length && <p className="muted">لا توجد تسجيلات مطابقة.</p>}
  </section>;
}
