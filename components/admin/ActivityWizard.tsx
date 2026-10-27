"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarDays, Check, FileText, Info, MapPin, Users } from "lucide-react";
import { createActivity } from "@/app/admin/actions";
import ActivitySchedulePicker from "./ActivitySchedulePicker";
import ActivitySessionsEditor from "./ActivitySessionsEditor";
import ActivityFormBuilder from "./ActivityFormBuilder";
import DepartmentChecklist from "./DepartmentChecklist";
import styles from "./ActivityWizard.module.css";
import { ActivityAttendanceProvider, ActivityAttendanceMode, ActivityAttendanceFields, ActivityLocationField, useActivityAttendance } from "./ActivityAttendanceSettings";

const steps = ["بيانات النشاط", "الموعد والأقسام", "نموذج التسجيل", "المراجعة والنشر"];
type Preview = { title: string; description: string; location: string; capacity: string; price: string; date: string; departments: string; questions: number; registration: string };
const emptyPreview: Preview = { title: "", description: "", location: "", capacity: "", price: "", date: "", departments: "", questions: 0, registration: "" };

export default function ActivityWizard({ departments, allowGeneral }: { departments: { id: string; nameAr: string }[]; allowGeneral: boolean }) {
  return <ActivityAttendanceProvider><ActivityWizardForm departments={departments} allowGeneral={allowGeneral} /></ActivityAttendanceProvider>;
}

function ActivityWizardForm({ departments, allowGeneral }: { departments: { id: string; nameAr: string }[]; allowGeneral: boolean }) {
  const { enabled: attendanceEnabled } = useActivityAttendance();
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const submitting = useRef(false);
  const [step, setStep] = useState(0);
  const [paid, setPaid] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<Preview>(emptyPreview);

  function refreshPreview() {
    if (!form.current) return;
    const data = new FormData(form.current);
    const value = (key: string) => String(data.get(key) ?? "");
    const selected = data.getAll("departmentIds").map(String);
    let questions = 0;
    try { questions = JSON.parse(value("registrationQuestions") || "[]").length; } catch { /* Builder manages the serialized value. */ }
    setPreview({ title: value("title"), description: value("cardDescription") || value("description"), location: value("location"), capacity: value("capacity"), price: value("price"), date: [value("startDate"), value("startTime")].filter(Boolean).join(" · "), departments: departments.filter(d => selected.includes(d.id)).map(d => d.nameAr).join("، "), questions, registration: [value("registrationOpenDate"), value("registrationCloseDate")].filter(Boolean).join(" ← ") });
  }

  function goTo(next: number) {
    refreshPreview();
    setStep(next);
    requestAnimationFrame(() => heading.current?.focus());
  }

  function validate(section?: number) {
    const panels = form.current?.querySelectorAll<HTMLElement>("[data-step]");
    if (!panels) return false;
    for (const panel of panels) {
      const index = Number(panel.dataset.step);
      if (section !== undefined && index !== section) continue;
      const invalid = Array.from(panel.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input,select,textarea")).find(input => input.willValidate && !input.validity.valid);
      if (invalid) {
        goTo(index);
        requestAnimationFrame(() => { invalid.focus(); invalid.reportValidity(); });
        return false;
      }
      if (index === 2) {
        const data = new FormData(form.current!);
        if (["registrationOpenDate", "registrationOpenTime", "registrationCloseDate", "registrationCloseTime"].some(name => !data.get(name))) {
          setMessage("حدد تاريخ ووقت فتح التسجيل وإغلاقه قبل الحفظ.");
          goTo(2);
          return false;
        }
      }
    }
    setMessage("");
    return true;
  }

  async function save(draft: boolean) {
    if (submitting.current || !validate()) return;
    const data = new FormData(form.current!);
    if (draft) data.set("status", "DRAFT");
    submitting.current = true;
    setPending(true);
    setMessage("");
    try {
      const result = await createActivity(data);
      if (result.success) {
        router.push("/admin/activities?success=" + encodeURIComponent(result.message));
        router.refresh();
      } else setMessage(result.message);
    } catch { setMessage("تعذر الاتصال. بياناتك ما زالت موجودة، حاول مجددًا."); }
    finally { submitting.current = false; setPending(false); }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (step < 3) { if (validate(step)) goTo(step + 1); }
    else void save(false);
  }

  return <div className={styles.wizard} dir="rtl">
    <header className={styles.header}><div><p className={styles.breadcrumb}>الأنشطة / إضافة نشاط</p><h1>إضافة نشاط جديد</h1><p>جهّز نشاطك ونموذج التسجيل بخطوات واضحة.</p></div><Link href="/admin/activities" className={styles.back}><ArrowRight size={17} /> العودة للأنشطة</Link></header>
    <nav aria-label="خطوات إضافة النشاط" className={styles.steps}>{steps.map((label, index) => <button type="button" key={label} aria-current={step === index ? "step" : undefined} className={`${styles.step} ${step === index ? styles.active : ""} ${index < step ? styles.complete : ""}`} onClick={() => { if (index <= step || validate(step)) goTo(index); }}><span>{index < step ? <Check size={18} /> : index + 1}</span><strong>{label}</strong></button>)}</nav>
    <form ref={form} noValidate onSubmit={submit} onChange={() => requestAnimationFrame(refreshPreview)} aria-busy={pending}>
      {message && <p className={styles.error} role="alert">{message}</p>}
      <fieldset disabled={pending} className={styles.fields}>
        <div className={styles.layout}>
          <main className={styles.card}>
            <div className={styles.cardHeading}><span className={styles.eyebrow}>الخطوة {step + 1} من 4</span><h2 ref={heading} tabIndex={-1}>{steps[step]}</h2><p>{["ابدأ بالمعلومات التي سيشاهدها الطلاب.", "حدد جلسات النشاط والأقسام المستهدفة.", "اضبط فترة التسجيل وأضف الأسئلة المطلوبة.", "راجع التفاصيل وحدد حالة النشاط قبل الحفظ."][step]}</p></div>
            <section data-step="0" hidden={step !== 0} className={styles.panel}>
              <ActivityAttendanceMode />
              <label>اسم النشاط <em>*</em><input name="title" required maxLength={200} placeholder="مثال: ورشة أساسيات الذكاء الاصطناعي" /></label>
              <label>وصف مختصر للبطاقة<textarea name="cardDescription" rows={3} maxLength={500} placeholder="ما الذي سيستفيده الطالب من النشاط؟" /><small>نبذة قصيرة تظهر في بطاقة النشاط · حتى 500 حرف</small></label>
              <label>الوصف الكامل <em>*</em><textarea name="description" required rows={6} maxLength={10000} placeholder="عرّف بالنشاط ومحاوره والفئة المستهدفة..." /></label>
              <details className={styles.optional}><summary>وصف شريط الإعلانات <span>اختياري</span></summary><label>النص المختصر<textarea name="tickerDescription" maxLength={300} rows={2} placeholder="نص قصير يظهر في شريط آخر تحديثات النادي" /></label></details>
              <div className={styles.grid}><ActivityLocationField /><label>{attendanceEnabled ? "السعة الطلابية" : "الحد الأقصى للتسجيلات"} <em>*</em><input name="capacity" type="number" min={1} max={100000} required placeholder="مثال: 100" /></label></div>
              <div className={styles.payment}><span>رسوم المشاركة</span><div role="group" aria-label="رسوم المشاركة"><button type="button" aria-pressed={!paid} onClick={() => { setPaid(false); requestAnimationFrame(refreshPreview); }}>مجاني</button><button type="button" aria-pressed={paid} onClick={() => setPaid(true)}>مدفوع</button></div>{paid ? <label>السعر (₪)<input name="price" type="number" required min={1} max={1000000} step={1} placeholder="السعر بالشيكل" /></label> : <input type="hidden" name="price" value="" />}</div>
            </section>
            <section data-step="1" hidden={step !== 1} className={styles.panel}><ActivityAttendanceFields><ActivitySchedulePicker /><ActivitySessionsEditor /></ActivityAttendanceFields><DepartmentChecklist departments={departments} allowGeneral={allowGeneral} /></section>
            <section data-step="2" hidden={step !== 2} className={styles.panel}><ActivityFormBuilder appearance="wizard" /></section>
            <section data-step="3" hidden={step !== 3} className={styles.panel}>
              <div className={styles.review}><h3>{preview.title || "نشاط جديد"}</h3><p>{preview.description}</p><dl><dt>نظام النشاط</dt><dd>{attendanceEnabled ? "فعالية بحضور وغياب" : "تسجيل فقط"}</dd><dt>المكان</dt><dd>{preview.location || "—"}</dd><dt>{attendanceEnabled ? "المقاعد" : "الحد الأقصى للتسجيلات"}</dt><dd>{preview.capacity || "—"}</dd>{attendanceEnabled && <><dt>الموعد</dt><dd>{preview.date || "يُحدد لاحقًا"}</dd></>}<dt>رسوم المشاركة</dt><dd>{preview.price ? `${preview.price} ₪` : "مجاني"}</dd><dt>الأقسام</dt><dd>{preview.departments || "جميع الأقسام المتاحة"}</dd><dt>فترة التسجيل</dt><dd>{preview.registration || "لم تُحدد"}</dd><dt>أسئلة التسجيل</dt><dd>{preview.questions} سؤال</dd></dl><button type="button" className={styles.back} onClick={() => goTo(2)}>مراجعة نموذج التسجيل <ArrowLeft size={16} /></button></div>
              <label>حالة النشاط<select name="status" defaultValue="PUBLISHED"><option value="PUBLISHED">منشور — يظهر للطلاب</option><option value="DRAFT">مسودة — لا يظهر للطلاب</option><option value="ARCHIVED">مؤرشف</option></select></label><p className={styles.note}><Info size={18} /> راجع المواعيد والأسئلة. حفظ المسودة يتطلب استكمال بيانات النشاط وفترة التسجيل.</p>
            </section>
          </main>
          <aside className={styles.sidebar}><div className={styles.preview}><div className={styles.previewTitle}><h2>معاينة بطاقة النشاط</h2><span>معاينة</span></div><div className={styles.art}><CalendarDays size={62} strokeWidth={1.5} /></div><h3>{preview.title || "عنوان نشاطك يظهر هنا"}</h3><p className={styles.description}>{preview.description || "أضف نبذة قصيرة لتساعد الطلاب على التعرف على النشاط."}</p><ul><li><CalendarDays size={18} />{preview.date || "الموعد يُحدد في الخطوة التالية"}</li><li><MapPin size={18} />{preview.location || "مكان النشاط"}</li><li><Users size={18} />{preview.capacity ? `${preview.capacity} مقعدًا` : "عدد المقاعد"}</li></ul><span className={styles.price}>{preview.price ? `${preview.price} ₪` : "مجاني"}</span><div className={styles.previewButton}>التسجيل في النشاط</div></div><div className={styles.tip}><Info size={19} /><div><strong>نصيحة</strong><p>اختر عنوانًا واضحًا ووصفًا يساعد الطلاب على معرفة ما سيستفيدون منه.</p></div></div></aside>
        </div>
        <footer className={styles.actions}><span>الخطوة {step + 1} من 4</span><div>{step > 0 && <button type="button" className={styles.back} onClick={() => goTo(step - 1)}><ArrowRight size={17} /> السابق</button>}<button type="button" className={styles.back} onClick={() => void save(true)}><FileText size={17} /> حفظ كمسودة</button><button className={styles.primary} type="submit">{pending ? "جارٍ الحفظ..." : step < 3 ? `التالي: ${steps[step + 1]}` : "حفظ النشاط ونموذج التسجيل"}<ArrowLeft size={18} /></button></div></footer>
      </fieldset>
    </form>
  </div>;
}
