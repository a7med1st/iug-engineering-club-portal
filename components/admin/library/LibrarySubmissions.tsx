import { Download, Eye, Inbox } from "lucide-react";
import { reviewLibrarySubmissionAction } from "@/app/admin/library/submission-actions";
import styles from "./LibrarySubmissions.module.css";

type Submission = { id: string; title: string; note: string | null; originalName: string; size: number; createdAt: Date; student: { name: string } };
type Folder = { id: string; name: string; course: { name: string } };

export default function LibrarySubmissions({ departmentId, submissions, folders }: { departmentId: string; submissions: Submission[]; folders: Folder[] }) {
  return <section className={styles.section}>
    <header><Inbox size={20} aria-hidden="true" /><h2>ملفات الطلاب بانتظار المراجعة</h2><span>{submissions.length}</span></header>
    {submissions.length ? <div className={styles.list}>{submissions.map((submission) => <article key={submission.id} className={styles.item}>
      <div className={styles.info}><strong>{submission.title}</strong><span>{submission.student.name} · {submission.originalName} · {(submission.size / 1024 / 1024).toFixed(2)} MB · {new Intl.DateTimeFormat("ar", { dateStyle: "medium" }).format(submission.createdAt)}</span>{submission.note && <p>{submission.note}</p>}</div>
      <div className={styles.preview}><a href={`/admin/library/submissions/${submission.id}`} target="_blank" rel="noopener noreferrer"><Eye size={16} /> عرض</a><a href={`/admin/library/submissions/${submission.id}?download=1`}><Download size={16} /> تنزيل</a></div>
      <form action={reviewLibrarySubmissionAction} className={styles.actions}>
        <input type="hidden" name="submissionId" value={submission.id} /><input type="hidden" name="departmentId" value={departmentId} />
        <label>مجلد النشر<select name="folderId" defaultValue="" disabled={!folders.length} required><option value="" disabled>اختر المجلد</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.course.name} / {folder.name}</option>)}</select></label>
        <button name="decision" value="approve" disabled={!folders.length} className={styles.approve}>نشر</button>
        <button name="decision" value="reject" formNoValidate className={styles.reject}>رفض</button>
      </form>
    </article>)}</div> : <p className={styles.empty}>لا توجد ملفات بانتظار المراجعة.</p>}
  </section>;
}
