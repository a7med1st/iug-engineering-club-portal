"use client";

import { useRef, useState } from "react";
import { levelNames, semesterNames } from "@/lib/library/levels";
import styles from "./CourseCreateForm.module.css";

type Match = { id: string; name: string; departments: string[] };

export default function CourseCreateForm({ action, departmentId }: { action: (data: FormData) => void | Promise<void>; departmentId?: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const [match, setMatch] = useState<Match | null>(null);
  const [checking, setChecking] = useState(false);

  async function check(code: string) {
    if (!code.trim()) { setMatch(null); return null; }
    setChecking(true);
    try {
      const params = new URLSearchParams({ code });
      if (departmentId) params.set("departmentId", departmentId);
      const response = await fetch(`/api/library/course-match?${params}`);
      const payload = response.ok ? await response.json() as { match: Match | null } : { match: null };
      setMatch(payload.match);
      return payload.match;
    } finally { setChecking(false); }
  }

  return <form ref={formRef} action={action} className={styles.form} onSubmit={async (event) => {
    if (confirmRef.current?.value === "true") return;
    const code = String(new FormData(event.currentTarget).get("code") ?? "");
    if (!code.trim()) return;
    event.preventDefault();
    const found = await check(code);
    if (!found && confirmRef.current) {
      confirmRef.current.value = "true";
      formRef.current?.requestSubmit();
    }
  }}>
    {departmentId && <input type="hidden" name="departmentId" value={departmentId} />}
    <input ref={confirmRef} type="hidden" name="confirmExisting" defaultValue="false" />
    <input name="name" required maxLength={120} placeholder="اسم المساق" />
    <input name="code" maxLength={40} placeholder="رمز المساق" onChange={() => {
      setMatch(null);
      if (confirmRef.current) confirmRef.current.value = "false";
    }} onBlur={(event) => void check(event.currentTarget.value)} />
    <select name="level" aria-label="المستوى">{levelNames.map((name, i) => <option value={i + 1} key={name}>المستوى {name}</option>)}</select>
    <select name="semester" aria-label="الفصل">{semesterNames.map((name, i) => <option value={i + 1} key={name}>{name}</option>)}</select>
    <input name="sortOrder" type="number" min="0" defaultValue="0" aria-label="ترتيب المساق" />
    <textarea name="description" maxLength={500} placeholder="وصف اختياري" />
    {checking && <p className={styles.note}>جارٍ التحقق من رمز المساق...</p>}
    {match && <div className={styles.match} role="status"><strong>هذا المساق مضاف بالفعل: {match.name}</strong><span>{match.departments.join("، ")}</span><small>سيظهر نفس المحتوى والملفات في قسمك ويبقى متزامنًا.</small></div>}
    <button type="submit" className="btn primary" onClick={() => { if (match && confirmRef.current) confirmRef.current.value = "true"; }}>{match ? "ربط المساق ومحتواه" : "إضافة المساق"}</button>
  </form>;
}
