"use client";

import { CheckCircle2, Eye, FileText, ImageIcon, Save } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { saveDocumentationSummary } from "@/app/admin/activities/[id]/documentation/actions";
import styles from "@/app/admin/activities/[id]/documentation/documentation.module.css";

type Props = {
  activity: { id: string; title: string; description: string; postEventSummary: string | null; coverImageUrl: string | null; images: { id: string; url: string }[] };
  children: ReactNode;
};

export default function ActivityDocumentationEditor({ activity, children }: Props) {
  const router = useRouter();
  const [summary, setSummary] = useState(activity.postEventSummary ?? "");
  const [saved, setSaved] = useState(activity.postEventSummary ?? "");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const previewRef = useRef<HTMLElement>(null);
  const storageKey = `activity-documentation:${activity.id}`;
  const dirty = summary !== saved;

  useEffect(() => {
    try {
      const draft = sessionStorage.getItem(storageKey);
      if (draft !== null && draft !== (activity.postEventSummary ?? "")) {
        setSummary(draft);
        setMessage("تمت استعادة مسودتك غير المحفوظة.");
      }
    } catch { /* The editor also works with browser storage disabled. */ }
    setReady(true);
  }, [storageKey]); // Keep the draft when image actions refresh server props.

  useEffect(() => {
    if (!ready) return;
    try {
      if (dirty) sessionStorage.setItem(storageKey, summary);
      else sessionStorage.removeItem(storageKey);
    } catch { /* Storage is optional. */ }
  }, [dirty, ready, storageKey, summary]);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const followLink = (event: MouseEvent) => {
      const link = (event.target as Element).closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.origin !== location.origin || link.getAttribute("href")?.startsWith("#")) return;
      if (!window.confirm("لديك تعديلات غير محفوظة. هل تريد مغادرة الصفحة؟")) {
        event.preventDefault(); event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", followLink, true);
    return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", followLink, true); };
  }, [dirty]);

  async function save() {
    if (pending) return;
    setPending(true); setError(""); setMessage("");
    const submitted = summary;
    try {
      const result = await saveDocumentationSummary(activity.id, submitted);
      if (result.error) setError(result.error);
      else {
        setSaved(submitted);
        setMessage("تم حفظ التوثيق بنجاح.");
        router.refresh();
      }
    } catch { setError("تعذّر الاتصال. حاول الحفظ مرة أخرى."); }
    finally { setPending(false); }
  }

  return (
    <>
      <div className={styles.editorLayout}>
        <div className={styles.editorColumn}>
          <section className={styles.panel}>
            <div className={styles.panelHeading}>
              <div><h2><FileText size={20} /> ملخص التنفيذ</h2><p>احكِ ما حدث، وأبرز الإنجازات وأثر النشاط على المشاركين.</p></div>
            </div>
            <form id="documentation-summary" className={styles.summaryForm} onSubmit={(event) => { event.preventDefault(); void save(); }}>
              <label htmlFor="post-event-summary">ماذا حدث في النشاط؟</label>
              <textarea id="post-event-summary" name="postEventSummary" value={summary} onChange={(event) => { setSummary(event.target.value); setMessage(""); }} rows={12} maxLength={10_000} placeholder="ابدأ بوصف ما نُفّذ، ثم اذكر أبرز المحاور والنتائج ولحظات التفاعل…" aria-describedby="summary-help summary-count" />
              <div className={styles.editorHints}><small id="summary-help">تظهر الفقرات كما تكتبها في صفحة النشاط.</small><small id="summary-count">{summary.length.toLocaleString("ar-PS")} / ١٠٬٠٠٠</small></div>
            </form>
          </section>
          {children}
        </div>
        <aside className={`${styles.panel} ${styles.livePreview}`} ref={previewRef} tabIndex={-1} aria-label="معاينة توثيق النشاط">
          <div className={styles.panelHeading}><div><h2><Eye size={20} /> معاينة للزوار</h2><p>معاينة النص أثناء الكتابة مع الصور المحفوظة.</p></div></div>
          {activity.coverImageUrl ? <img className={styles.previewCover} src={activity.coverImageUrl} alt={`غلاف ${activity.title}`} /> : <div className={styles.previewEmpty}><ImageIcon size={36} /><span>أضف غلافاً ليظهر هنا</span></div>}
          {summary.trim() && <span className={styles.pastBadge}><CheckCircle2 size={14} /> نشاط موثّق</span>}
          <h3>{activity.title}</h3>
          <p className={styles.previewText}>{summary.trim() || activity.description}</p>
          {activity.images.length > 0 && <div className={styles.previewPhotos}>{activity.images.slice(0, 4).map((image, index) => <img key={image.id} src={image.url} alt={`صورة ${index + 1} من النشاط`} />)}</div>}
        </aside>
      </div>
      <div className={styles.saveBar}>
        <div role="status" aria-live="polite" className={error ? styles.errorText : styles.saveStatus}>
          <span className={dirty ? styles.unsavedDot : styles.savedDot} />
          {error || message || (pending ? "جارٍ حفظ التوثيق…" : dirty ? "تغييرات غير محفوظة" : "جميع التعديلات محفوظة")}
        </div>
        <div className={styles.saveActions}>
          <button type="button" className="ghost-btn" onClick={() => { previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); previewRef.current?.focus({ preventScroll: true }); }}><Eye size={18} /> معاينة</button>
          <button form="documentation-summary" type="submit" className="primary-btn" disabled={pending || !ready || !dirty}><Save size={18} />{pending ? "جارٍ الحفظ…" : "حفظ التوثيق"}</button>
        </div>
      </div>
    </>
  );
}
