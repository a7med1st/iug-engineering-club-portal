"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Upload } from "lucide-react";
import { LIBRARY_MAX_FILE_MB } from "@/lib/library/constants";
import styles from "@/app/library/library.module.css";

export default function LibrarySubmissionForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/library/submissions", { method: "POST", body: new FormData(form) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "تعذر إرسال الملف.");
      form.reset();
      setSelectedFile("");
      setMessage("وصل الملف إلى مندوب القسم للمراجعة.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر إرسال الملف.");
    } finally {
      setBusy(false);
    }
  }
  return <section className={styles.submissionSection}>
    <h2>شارك ملفًا مع مكتبة التخصص</h2>
    <form onSubmit={submit} className={styles.submissionForm}>
      <label>عنوان الملف<input name="title" required maxLength={120} placeholder="مثال: ملخص دوائر كهربائية" /></label>
      <label>الملف
        <span className={styles.filePicker}>
          <input name="file" type="file" required aria-label="اختيار ملف للمكتبة" onChange={(event) => setSelectedFile(event.currentTarget.files?.[0]?.name ?? "")} />
          <span className={styles.fileChoose}><Paperclip size={17} aria-hidden="true" /> اختيار ملف</span>
          <span className={styles.fileName}>{selectedFile || "لم يتم اختيار ملف"}</span>
        </span>
      </label>
      <label className={styles.fullField}>ملاحظة للمندوب (اختياري)<textarea name="note" maxLength={500} rows={2} /></label>
      <div className={styles.submissionFooter}><span>حتى {LIBRARY_MAX_FILE_MB} MB. يظهر الملف في المكتبة بعد موافقة مندوب القسم.</span><button type="submit" disabled={busy}><Upload size={17} aria-hidden="true" />{busy ? "جارٍ الإرسال..." : "إرسال للمراجعة"}</button></div>
      {message && <p role="status" className={styles.submissionMessage}>{message}</p>}
    </form>
  </section>;
}
