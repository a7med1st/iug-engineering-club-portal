"use client";

import { useState } from "react";
import { Check, Minus, Search } from "lucide-react";
import { getAttendanceProgress } from "@/lib/activity-attendance";
import { getSessionAttendanceSummaries } from "@/lib/activity-attendance-matrix";
import styles from "./ActivityAttendanceMatrix.module.css";

type Session = { id: string; title: string };
type Submission = { id: string; studentName: string; status: string; checkedInAt: Date | null; sessionAttendances: { sessionId: string }[] };
export default function ActivityAttendanceMatrix({ activityId, sessions, requiredAttendanceCount, submissions: allSubmissions, canManage, action }: {
  activityId: string; sessions: Session[]; requiredAttendanceCount: number; submissions: Submission[]; canManage: boolean; action: (form: FormData) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const normalize = (value: string) => value.normalize("NFKD").replace(/\p{M}/gu, "").replace(/\u0640/g, "").toLocaleLowerCase().trim();
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const submissions = allSubmissions.filter(submission => terms.every(term => normalize(submission.studentName).includes(term)));
  const sessionSummaries = new Map(getSessionAttendanceSummaries(sessions, allSubmissions).map(summary => [summary.sessionId, summary]));
  const approvedSubmissions = allSubmissions.filter(submission => submission.status === "APPROVED");
  const eligibleCount = approvedSubmissions.filter(submission => getAttendanceProgress({ ...submission, form: { activity: { sessions, requiredAttendanceCount } } }).eligible).length;

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
  function sessionHeader(session: Session) {
    const summary = sessionSummaries.get(session.id) ?? { presentCount: 0, totalCount: 0, rate: 0 };
    return <span className={styles.sessionHeader}><span>{session.title}</span><small>{summary.presentCount}/{summary.totalCount} · {summary.rate}%</small></span>;
  }

  return <section className={styles.matrix}>
    <label className={styles.search}><Search size={18} aria-hidden="true"/><input type="search" aria-label="البحث باسم الطالب" placeholder="البحث باسم الطالب" value={query} onChange={event => setQuery(event.target.value)}/></label>
    <h2>حضور الجلسات</h2>
    <div className={styles.desktop}><table><thead><tr><th scope="col">الطالب</th>{sessions.map(session => <th key={session.id} scope="col">{sessionHeader(session)}</th>)}<th scope="col"><span className={styles.sessionHeader}><span>الاستحقاق</span><small>{eligibleCount}/{approvedSubmissions.length}</small></span></th></tr></thead><tbody>{submissions.map(submission => <tr key={submission.id}><th scope="row">{submission.studentName}</th>{sessions.map(session => <td key={session.id}>{toggle(submission, session)}</td>)}<td>{progress(submission)}</td></tr>)}</tbody></table></div>
    <div className={styles.mobile}>{submissions.map(submission => <article key={submission.id}><h3>{submission.studentName}</h3><p>{progress(submission)}</p>{sessions.map(session => <div className={styles.mobileRow} key={session.id}><span>{session.title}</span>{toggle(submission, session)}</div>)}</article>)}</div>
    {!submissions.length && <p className="muted">لا توجد تسجيلات مطابقة.</p>}
  </section>;
}
