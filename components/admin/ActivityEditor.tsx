"use client";

import { useCallback, useEffect, useRef, useState, useTransition, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarDays, Check, ClipboardList, Eye, FileText, ImageIcon, LoaderCircle, Save, Settings2, Users, X } from "lucide-react";
import { saveActivityEdits } from "@/app/admin/actions";
import { formatActivityTimestamp } from "@/lib/activities";
import { visibleQuestionIds, type QuestionCondition } from "@/lib/registration-conditions";
import ActivityFormBuilder, { type ActivityFormBuilderInitialQuestion } from "./ActivityFormBuilder";
import ActivitySessionsEditor, { type EditableActivitySession } from "./ActivitySessionsEditor";
import ActivitySchedulePicker from "./ActivitySchedulePicker";
import DepartmentChecklist from "./DepartmentChecklist";
import { ActivityAttendanceProvider, ActivityAttendanceMode, ActivityAttendanceFields, ActivityLocationField, useActivityAttendance } from "./ActivityAttendanceSettings";
import styles from "./ActivityEditor.module.css";

const tabs = [
  { id: "details", label: "البيانات الأساسية", icon: FileText },
  { id: "schedule", label: "الموعد والأقسام", icon: CalendarDays },
  { id: "registration", label: "إعدادات التسجيل", icon: Settings2 },
  { id: "questions", label: "الأسئلة", icon: ClipboardList },
  { id: "documentation", label: "التوثيق", icon: ImageIcon },
] as const;
type Tab = (typeof tabs)[number]["id"];
type InputDate = { date: string; time: string };
type PreviewQuestion = { label: string; type: string; required: boolean; options: string[]; helpText: string; placeholder: string; condition: QuestionCondition | null };
type Preview = { title: string; description: string; location: string; capacity: string; price: string; questions: PreviewQuestion[] };

export type ActivityEditorProps = {
  activity: {
    id: string; title: string; description: string; cardDescription: string | null; tickerDescription: string | null;
    location: string; capacity: number; price: number | null; status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    attendanceEnabled: boolean; coverImageUrl: string | null; postEventSummary: string | null; updatedAt: string;
    start: InputDate; end: InputDate; requiredAttendanceCount: number; sessions: EditableActivitySession[];
    registration: { title: string; description: string; isOpen: boolean; requiresAccount: boolean; open: InputDate; close: InputDate; questions: ActivityFormBuilderInitialQuestion[] };
  };
  departments: { id: string; nameAr: string }[];
  initialDepartmentIds: string[];
  allowGeneral: boolean;
  canSave: boolean;
  initialError?: string;
  initialSuccess?: string;
};

function fingerprint(form: HTMLFormElement, savedQuestionsOnly = false) {
  const data = new FormData(form);
  if (savedQuestionsOnly) {
    const questions = JSON.parse(String(data.get("registrationQuestions") ?? "[]")) as { id?: string | null }[];
    data.set("registrationQuestions", JSON.stringify(questions.filter(question => question.id)));
  }
  return JSON.stringify(Array.from(data.entries()).map(([name, value]) => [name, String(value)]).sort(([a, av], [b, bv]) => a.localeCompare(b) || av.localeCompare(bv)));
}

export default function ActivityEditor(props: ActivityEditorProps) {
  return <ActivityAttendanceProvider initialEnabled={props.activity.attendanceEnabled}><EditorForm {...props} /></ActivityAttendanceProvider>;
}

function EditorForm({ activity, departments, initialDepartmentIds, allowGeneral, canSave, initialError, initialSuccess }: ActivityEditorProps) {
  const router = useRouter();
  const { enabled: attendanceEnabled } = useActivityAttendance();
  const root = useRef<HTMLElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const baseline = useRef<string | null>(null);
  const lastFingerprint = useRef("");
  const busy = useRef(false);
  const dirtyRef = useRef(false);
  const [activeTab, setActiveTab] = useState<Tab>("details");
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const saving = pending || refreshing;
  const [notice, setNotice] = useState<{ success: boolean; message: string } | null>(initialError ? { success: false, message: initialError } : initialSuccess ? { success: true, message: initialSuccess } : null);
  const [summary, setSummary] = useState({ title: activity.title, status: activity.status as string, count: activity.registration.questions.length });
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, string>>({});

  const refresh = useCallback(() => {
    if (!form.current || baseline.current === null || busy.current || form.current.querySelector<HTMLFieldSetElement>(":scope > fieldset")?.disabled) return;
    const current = fingerprint(form.current);
    if (current === lastFingerprint.current) return;
    lastFingerprint.current = current;
    dirtyRef.current = current !== baseline.current;
    setDirty(dirtyRef.current);
    const data = new FormData(form.current);
    let count = 0;
    try { count = JSON.parse(String(data.get("registrationQuestions") ?? "[]")).length; } catch { /* The builder owns this value. */ }
    setSummary({ title: String(data.get("title") ?? ""), status: String(data.get("status") ?? "DRAFT"), count });
  }, []);

  useEffect(() => {
    const node = form.current;
    if (!node) return;
    baseline.current = null;
    let frame = 0;
    const initialize = () => {
      if (busy.current || node.querySelector<HTMLFieldSetElement>(":scope > fieldset")?.disabled) { frame = requestAnimationFrame(initialize); return; }
      baseline.current = fingerprint(node, true);
      lastFingerprint.current = "";
      refresh();
    };
    frame = requestAnimationFrame(initialize);
    const observer = new MutationObserver(refresh);
    observer.observe(node, { subtree: true, childList: true, attributes: true, attributeFilter: ["value", "checked", "disabled"] });
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [activity.updatedAt, refresh]);

  useEffect(() => {
    const bars = Array.from(document.querySelectorAll<HTMLElement>(".site-header, .admin-mobile-nav"));
    const measure = () => root.current?.style.setProperty("--editor-sticky-top", `${bars.reduce((height, bar) => height + bar.getBoundingClientRect().height, 0)}px`);
    const observer = new ResizeObserver(measure);
    bars.forEach(bar => observer.observe(bar));
    measure();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const leave = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href]");
      if (!dirtyRef.current || !link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || link.target === "_blank" || link.hasAttribute("download")) return;
      const target = new URL(link.href, location.href);
      if (target.pathname === location.pathname && target.origin === location.origin && target.search === location.search) return;
      if (!window.confirm("لديك تعديلات غير محفوظة. هل تريد مغادرة الصفحة؟")) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener("beforeunload", unload);
    window.addEventListener("click", leave, true);
    return () => { window.removeEventListener("beforeunload", unload); window.removeEventListener("click", leave, true); };
  }, []);

  function selectTab(tab: Tab, focus = false) {
    setActiveTab(tab);
    requestAnimationFrame(() => {
      if (focus) document.getElementById(`activity-tab-${tab}`)?.focus();
      document.getElementById(`activity-panel-${tab}`)?.scrollIntoView({ block: "start" });
      document.getElementById(`activity-tab-${tab}`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  }

  function tabKey(event: KeyboardEvent, index: number) {
    let next = index;
    if (event.key === "ArrowLeft") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowRight") next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    selectTab(tabs[next].id, true);
  }

  function revealInvalid(input: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
    const panel = input.closest<HTMLElement>("[data-editor-panel]");
    if (panel) setActiveTab(panel.dataset.editorPanel as Tab);
    const question = input.closest<HTMLElement>("[data-question-id]");
    if (question) document.dispatchEvent(new CustomEvent("activity-question-reveal", { detail: question.dataset.questionId }));
    requestAnimationFrame(() => requestAnimationFrame(() => { input.focus(); input.reportValidity(); }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.current || busy.current || refreshing || !canSave || !dirtyRef.current) return;
    const invalid = Array.from(form.current.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input,select,textarea")).find(input => input.willValidate && !input.validity.valid);
    if (invalid) { setNotice({ success: false, message: "راجع الحقل المحدد وأكمل البيانات المطلوبة." }); revealInvalid(invalid); return; }
    const data = new FormData(form.current);
    if (["registrationOpenDate", "registrationOpenTime", "registrationCloseDate", "registrationCloseTime"].some(name => !data.get(name))) {
      setNotice({ success: false, message: "حدد تاريخ ووقت فتح التسجيل وإغلاقه." });
      selectTab("registration");
      return;
    }
    const submitted = fingerprint(form.current);
    busy.current = true;
    setPending(true);
    setNotice(null);
    try {
      const result = await saveActivityEdits(data);
      setNotice(result);
      if (result.success) {
        baseline.current = submitted;
        lastFingerprint.current = submitted;
        dirtyRef.current = false;
        setDirty(false);
        startRefresh(() => router.refresh());
      }
    } catch {
      setNotice({ success: false, message: "تعذر الاتصال. تعديلاتك ما زالت موجودة، حاول مجددًا." });
    } finally { busy.current = false; setPending(false); }
  }

  function openPreview() {
    if (!form.current) return;
    const data = new FormData(form.current);
    const value = (name: string) => String(data.get(name) ?? "");
    let questions: PreviewQuestion[] = [];
    try { questions = JSON.parse(value("registrationQuestions") || "[]"); } catch { /* The builder owns this value. */ }
    setPreview({ title: value("title"), description: value("description"), location: value("location"), capacity: value("capacity"), price: value("price"), questions });
    setPreviewAnswers({});
    dialog.current?.showModal();
  }

  const previewQuestions = (preview?.questions ?? []).map((question, index) => ({ ...question, id: String(index) }));
  const visible = visibleQuestionIds(previewQuestions, previewAnswers);
  const registration = activity.registration;
  const formId = `activity-edit-${activity.id}`;
  const statusLabel = summary.status === "PUBLISHED" ? "منشور" : summary.status === "DRAFT" ? "مسودة" : "مؤرشف";

  return <section ref={root} className={styles.editor} dir="rtl">
    <header className={styles.header}>
      <div className={styles.heading}>
        <Link href="/admin/activities" className={styles.back}><ArrowRight size={16} />الأنشطة</Link>
        <div className={styles.titleRow}>{activity.coverImageUrl && <img className={styles.cover} src={activity.coverImageUrl} alt="" />}<div><h1>تعديل النشاط</h1><p>{summary.title || "نشاط بدون عنوان"}</p></div><span className={`${styles.status} ${summary.status === "PUBLISHED" ? styles.published : summary.status === "ARCHIVED" ? styles.archived : styles.draft}`}>{statusLabel}</span></div>
      </div>
      <Link href={`/admin/activities/${activity.id}/registrations`} className={styles.secondary}><Users size={17} />المسجلون</Link>
    </header>

    <nav role="tablist" aria-label="أقسام تعديل النشاط" className={styles.tabs}>{tabs.map((tab, index) => <button key={tab.id} type="button" role="tab" id={`activity-tab-${tab.id}`} aria-selected={activeTab === tab.id} aria-controls={`activity-panel-${tab.id}`} tabIndex={activeTab === tab.id ? 0 : -1} disabled={saving} onClick={() => selectTab(tab.id)} onKeyDown={event => tabKey(event, index)}><tab.icon size={17} /><span>{tab.id === "schedule" && !attendanceEnabled ? "الأقسام المستهدفة" : tab.label}</span>{tab.id === "questions" && <span className={styles.count}>{summary.count}</span>}</button>)}</nav>

    {notice && <p className={notice.success ? styles.success : styles.error} role={notice.success ? "status" : "alert"}>{notice.success && <Check size={17} />}{notice.message}</p>}

    <form id={formId} key={activity.updatedAt} ref={form} noValidate onSubmit={submit} onChange={() => requestAnimationFrame(refresh)} onInput={() => requestAnimationFrame(refresh)} className={styles.form} aria-busy={saving}>
      <input type="hidden" name="activityId" value={activity.id} />
      <fieldset disabled={saving} className={styles.fields}>
        <section role="tabpanel" id="activity-panel-details" aria-labelledby="activity-tab-details" data-editor-panel="details" hidden={activeTab !== "details"} className={styles.panel}>
          <h2>البيانات الأساسية</h2>
          <div className={styles.grid}><ActivityAttendanceMode /><label>حالة النشر<select name="status" defaultValue={activity.status}><option value="PUBLISHED">منشور</option><option value="DRAFT">مسودة</option><option value="ARCHIVED">مؤرشف</option></select></label></div>
          <label>اسم النشاط <span className={styles.required}>*</span><input name="title" required maxLength={160} defaultValue={activity.title} /></label>
          <label>نبذة بطاقة النشاط<textarea name="cardDescription" rows={3} maxLength={500} defaultValue={activity.cardDescription ?? ""} /></label>
          <label>الوصف الكامل <span className={styles.required}>*</span><textarea name="description" required rows={6} maxLength={10000} defaultValue={activity.description} /></label>
          <div className={styles.grid}><ActivityLocationField initialLocation={activity.location} /><label>{attendanceEnabled ? "السعة الطلابية" : "الحد الأقصى للتسجيلات"} <span className={styles.required}>*</span><input type="number" min={1} max={100000} name="capacity" required defaultValue={activity.capacity} /></label></div>
          <div className={styles.grid}><label>رسوم المشاركة (₪)<input type="number" name="price" min={0} max={1000000} step={1} defaultValue={activity.price ?? ""} placeholder="مجاني" /></label></div>
          <details className={styles.optional}><summary>نص شريط الإعلانات</summary><label>النص المختصر<textarea name="tickerDescription" rows={2} maxLength={300} defaultValue={activity.tickerDescription ?? ""} /></label></details>
        </section>

        <section role="tabpanel" id="activity-panel-schedule" aria-labelledby="activity-tab-schedule" data-editor-panel="schedule" hidden={activeTab !== "schedule"} className={styles.panel}>
          <h2>{attendanceEnabled ? "الموعد والأقسام" : "الأقسام المستهدفة"}</h2>
          <ActivityAttendanceFields><ActivitySchedulePicker initialStartDate={activity.start.date} initialStartTime={activity.start.time} initialEndDate={activity.end.date} initialEndTime={activity.end.time} /><ActivitySessionsEditor initialSessions={activity.sessions} initialRequiredAttendanceCount={activity.requiredAttendanceCount} /></ActivityAttendanceFields>
          <DepartmentChecklist departments={departments} initialSelectedIds={initialDepartmentIds} allowGeneral={allowGeneral} />
        </section>

        <section role="tabpanel" id="activity-panel-registration" aria-labelledby="activity-tab-registration" data-editor-panel="registration" hidden={activeTab !== "registration"} className={styles.panel}>
          <h2>إعدادات التسجيل</h2>
          <label>عنوان نموذج التسجيل<input name="registrationFormTitle" maxLength={160} defaultValue={registration.title} /></label>
          <label>وصف النموذج<textarea name="registrationFormDescription" rows={3} maxLength={3000} defaultValue={registration.description} /></label>
          <div className={styles.toggles}><label><input type="checkbox" name="registrationFormIsOpen" defaultChecked={registration.isOpen} /><span>تفعيل التسجيل</span></label><label><input type="checkbox" name="registrationFormRequiresAccount" defaultChecked={registration.requiresAccount} /><span>تسجيل الدخول مطلوب</span></label></div>
          <ActivitySchedulePicker kind="registration" initialStartDate={registration.open.date} initialStartTime={registration.open.time} initialEndDate={registration.close.date} initialEndTime={registration.close.time} />
        </section>

        <section role="tabpanel" id="activity-panel-questions" aria-labelledby="activity-tab-questions" data-editor-panel="questions" hidden={activeTab !== "questions"} className={styles.panel}>
          <ActivityFormBuilder appearance="editor" settingsHidden initialQuestions={registration.questions} />
        </section>

        <section role="tabpanel" id="activity-panel-documentation" aria-labelledby="activity-tab-documentation" data-editor-panel="documentation" hidden={activeTab !== "documentation"} className={styles.panel}>
          <h2>توثيق النشاط</h2>
          <label>ملخص النشاط<textarea name="postEventSummary" rows={9} maxLength={10000} defaultValue={activity.postEventSummary ?? ""} /></label>
          <Link href={`/admin/activities/${activity.id}/documentation`} className={styles.secondary}><ImageIcon size={17} />صور وتوثيق النشاط</Link>
        </section>
      </fieldset>
    </form>

    <footer className={styles.saveBar}>
      <div className={styles.saveState} aria-live="polite">{saving ? <><LoaderCircle size={17} className={styles.spinner} /><strong>جارٍ الحفظ</strong></> : dirty ? <><span className={styles.unsavedDot} /><strong>تغييرات غير محفوظة</strong></> : <><Check size={17} /><strong>جميع التغييرات محفوظة</strong></>}<small>آخر حفظ: {formatActivityTimestamp(new Date(activity.updatedAt))}</small></div>
      <div className={styles.saveActions}><button type="button" onClick={openPreview} className={styles.secondary} disabled={saving}><Eye size={17} />معاينة</button><button type="submit" form={formId} className={styles.primary} disabled={!dirty || saving || !canSave}>{saving ? <LoaderCircle size={17} className={styles.spinner} /> : <Save size={17} />}{saving ? "جارٍ الحفظ..." : "حفظ التعديلات"}</button></div>
    </footer>

    <dialog ref={dialog} className={styles.preview} aria-labelledby="activity-preview-title">
      <div className={styles.previewHeader}><h2 id="activity-preview-title">معاينة النشاط</h2><button type="button" title="إغلاق المعاينة" aria-label="إغلاق المعاينة" onClick={() => dialog.current?.close()}><X size={20} /></button></div>
      {preview && <div className={styles.previewContent}>{activity.coverImageUrl && <img src={activity.coverImageUrl} alt={preview.title} className={styles.previewCover} />}<span className={styles.previewMode}>{attendanceEnabled ? "فعالية بحضور" : "تسجيل فقط"}</span><h3>{preview.title}</h3><p className={styles.previewDescription}>{preview.description}</p><div className={styles.previewMeta}>{preview.location && <span>{preview.location}</span>}<span>{preview.capacity} تسجيل</span><span>{Number(preview.price) > 0 ? `${preview.price} ₪` : "مجاني"}</span></div><div className={styles.previewQuestions}>{previewQuestions.filter(question => visible.has(question.id)).map(question => <label key={question.id}>{question.label || "سؤال بدون عنوان"}{question.required && <span className={styles.required}> *</span>}{question.type === "LONG_TEXT" ? <textarea rows={3} placeholder={question.placeholder} value={previewAnswers[question.id] ?? ""} onChange={event => setPreviewAnswers(current => ({ ...current, [question.id]: event.target.value }))} /> : ["SELECT", "RADIO", "CHECKBOX"].includes(question.type) ? <select value={previewAnswers[question.id] ?? ""} onChange={event => setPreviewAnswers(current => ({ ...current, [question.id]: event.target.value }))}><option value="">اختر الإجابة</option>{question.options.map((option, index) => <option key={index}>{option}</option>)}</select> : <input type={question.type === "EMAIL" ? "email" : question.type === "NUMBER" ? "number" : question.type === "PHONE" ? "tel" : "text"} placeholder={question.placeholder} value={previewAnswers[question.id] ?? ""} onChange={event => setPreviewAnswers(current => ({ ...current, [question.id]: event.target.value }))} />}{question.helpText && <small>{question.helpText}</small>}</label>)}</div></div>}
    </dialog>
  </section>;
}
