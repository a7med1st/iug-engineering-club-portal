import { ExternalLink, Link2, Pencil, Plus, Trash2 } from "lucide-react";
import { createLinkAction, deleteLinkAction, updateLinkAction } from "@/app/admin/library/actions";
import styles from "./LibraryManager.module.css";

type LinkItem = { id: string; title: string; url: string; createdAt: Date };

export default function LibraryLinks({ folderId, links, department, course }: {
  folderId: string;
  links: LinkItem[];
  department: string;
  course: string;
}) {
  const context = <>
    <input type="hidden" name="department" value={department} />
    <input type="hidden" name="course" value={course} />
    <input type="hidden" name="folder" value={folderId} />
  </>;

  return <div className={styles.linkSection}>
    <div className={styles.linkHead}>
      <h3>روابط المحاضرات</h3>
      <details>
        <summary className={styles.addLink}><Plus size={17} /> إضافة رابط</summary>
        <form action={createLinkAction} className={styles.form}>
          {context}<input type="hidden" name="folderId" value={folderId} />
          <input name="title" required maxLength={180} placeholder="عنوان المحاضرة" aria-label="عنوان المحاضرة" />
          <input name="url" type="url" required maxLength={2048} placeholder="رابط المحاضرة https://" aria-label="رابط المحاضرة" dir="ltr" />
          <button className="btn primary">إضافة</button>
        </form>
      </details>
    </div>
    {links.length ? <div className={styles.fileList}>{links.map((link) => <article key={link.id}>
      <Link2 size={20} aria-hidden="true" />
      <div><strong>{link.title}</strong><small dir="ltr">{link.url}</small></div>
      <div className={styles.actions}>
        <a href={link.url} target="_blank" rel="noopener noreferrer" title="فتح الرابط" aria-label={`فتح ${link.title}`}><ExternalLink size={17} /></a>
        <details><summary title="تعديل الرابط" aria-label={`تعديل ${link.title}`}><Pencil size={16} /></summary>
          <form action={updateLinkAction} className={styles.form}>
            {context}<input type="hidden" name="linkId" value={link.id} />
            <input name="title" required maxLength={180} defaultValue={link.title} aria-label="عنوان المحاضرة" />
            <input name="url" type="url" required maxLength={2048} defaultValue={link.url} aria-label="رابط المحاضرة" dir="ltr" />
            <button className="btn primary">حفظ</button>
          </form>
        </details>
        <form action={deleteLinkAction}>{context}<input type="hidden" name="linkId" value={link.id} />
          <button className={styles.danger} title="حذف الرابط" aria-label={`حذف ${link.title}`}><Trash2 size={16} /></button>
        </form>
      </div>
    </article>)}</div> : <p className="empty-state">لا توجد روابط في هذا المجلد بعد.</p>}
  </div>;
}
