"use client";

import { useState, type ReactNode } from "react";
import { ImageUp, Save } from "lucide-react";
import styles from "./BilingualCertificateTemplates.module.css";

export default function BilingualCertificateTemplates({ arabic, english, arabicName, englishName, activityId, action }: { arabic: ReactNode; english: ReactNode; arabicName?: string; englishName?: string; activityId: string; action: (data: FormData) => void }) {
  const [active, setActive] = useState<"ar" | "en">("ar");
  const [names, setNames] = useState({ ar: arabicName, en: englishName });
  return <form action={action} className={styles.shell} onChange={event => {
    const input = event.target;
    if (input instanceof HTMLInputElement && input.type === "file" && input.files?.[0]) {
      const language = input.name.startsWith("en.") ? "en" : "ar";
      setNames(current => ({ ...current, [language]: input.files![0].name }));
      setActive(language);
    }
  }}>
    <input type="hidden" name="activityId" value={activityId} />
    <p className={styles.hint}>أرفق القالب العربي أو الإنجليزي أو كليهما. تُصدر الشهادة باللغات التي أرفقت قوالبها فقط، وبنفس رمز التحقق.</p>
    <div className={styles.slots}>{(["ar", "en"] as const).map(language => <section key={language} className={active === language ? styles.active : ""}>
      <label tabIndex={0} htmlFor={`template-file-${language}`} onClick={() => setActive(language)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setActive(language); document.getElementById(`template-file-${language}`)?.click(); } }}><ImageUp size={24} /><strong>إرفاق الشهادة باللغة {language === "ar" ? "العربية" : "الإنجليزية"}</strong><small>{names[language] || "PNG أو JPG أو WEBP · حتى 8 MB"}</small><span>{names[language] ? "استبدال الملف" : "اختيار ملف"}</span></label>
      <button type="button" aria-pressed={active === language} onClick={() => setActive(language)}>معاينة وضبط القالب {language === "ar" ? "العربي" : "الإنجليزي"}</button>
    </section>)}</div>
    <div hidden={active !== "ar"}>{arabic}</div><div hidden={active !== "en"}>{english}</div>
    <button className={styles.save} type="submit"><Save size={18} />حفظ قوالب الشهادة</button>
  </form>;
}
