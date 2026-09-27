"use client";
import { useEffect, useRef, useState } from "react";
import styles from "./LibraryManager.module.css";
export default function ConfirmDeleteButton() {
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef<HTMLFormElement | null>(null);
  const [label, setLabel] = useState("العنصر");
  useEffect(() => {
    const onSubmit = (event: SubmitEvent) => {
      const form = event.target instanceof HTMLFormElement ? event.target : null;
      const submitter = event.submitter instanceof HTMLElement ? event.submitter : null;
      if (!form || form.dataset.confirmed === "true" || !submitter?.classList.contains(styles.danger)) return;
      const field = form.querySelector<HTMLInputElement>('input[name="fileId"],input[name="folderId"],input[name="courseId"],input[name="linkId"]');
      if (!field) return;
      event.preventDefault(); pending.current = form;
      setLabel(field.name === "fileId" ? "الملف" : field.name === "folderId" ? "المجلد" : field.name === "linkId" ? "الرابط" : "المساق");
      dialog.current?.showModal();
    };
    document.addEventListener("submit", onSubmit, true);
    return () => document.removeEventListener("submit", onSubmit, true);
  }, []);
  return <dialog ref={dialog} className={styles.confirmDialog}><h3>تأكيد الحذف</h3><p>سيتم حذف {label} ومحتواه المرتبط نهائيًا.</p><div className={styles.actions}><button type="button" className="btn secondary" onClick={() => dialog.current?.close()}>إلغاء</button><button type="button" className={styles.confirmDanger} onClick={() => { const form = pending.current; dialog.current?.close(); if (form) { form.dataset.confirmed = "true"; form.requestSubmit(); } }}>تأكيد الحذف</button></div></dialog>;
}
