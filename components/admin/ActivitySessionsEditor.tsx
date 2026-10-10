"use client";

import { useId, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import styles from "./ActivitySessionsEditor.module.css";

export type EditableActivitySession = { id?: string; title: string; startDate?: string; startTime?: string; endDate?: string; endTime?: string; attendanceCount?: number };
export default function ActivitySessionsEditor({ initialSessions = [], initialRequiredAttendanceCount = 1 }: { initialSessions?: EditableActivitySession[]; initialRequiredAttendanceCount?: number }) {
  const group = useId();
  const [sessions, setSessions] = useState(() => (initialSessions.length ? initialSessions : [{ title: "الجلسة الرئيسية" }]).map((row, i) => ({ ...row, key: row.id ?? `${group}-${i}` })));
  const [series, setSeries] = useState(initialSessions.length > 1);
  const [required, setRequired] = useState(initialRequiredAttendanceCount);
  const [confirmed, setConfirmed] = useState<string[]>([]);
  function remove(index: number) {
    const row = sessions[index];
    if (row.id) {
      if (!window.confirm(row.attendanceCount ? `حذف «${row.title}» سيحذف ${row.attendanceCount} سجل حضور ورابط الجلسة. تأكيد الحذف؟` : `حذف «${row.title}» ورابطها؟`)) return;
      setConfirmed(ids => [...ids, row.id!]);
    }
    const next = sessions.filter((_, i) => i !== index);
    setSessions(next); setRequired(count => Math.min(count, next.length));
  }
  function move(index: number, offset: number) {
    setSessions(rows => { const next = [...rows]; [next[index], next[index + offset]] = [next[index + offset], next[index]]; return next; });
  }
  function selectSingle() {
    const removed = sessions.slice(1);
    if (removed.length && !window.confirm("التحويل لجلسة واحدة سيحذف الجلسات الإضافية وروابطها وجميع سجلات حضورها. تأكيد الحذف؟")) return;
    setConfirmed(ids => [...ids, ...removed.flatMap(row => row.id ? [row.id] : [])]);
    setSessions(rows => rows.slice(0, 1)); setRequired(1); setSeries(false);
  }
  return <section className={styles.editor}>
    <h2>جلسات النشاط</h2>
    <input type="hidden" name="activitySessions" value={JSON.stringify({ sessions: sessions.map(({ key, attendanceCount, ...row }) => row), requiredAttendanceCount: required, confirmedDeletedSessionIds: confirmed })} />
    <div className={styles.modes} role="radiogroup" aria-label="نوع النشاط">
      <label><input type="radio" name={`${group}-mode`} checked={!series} onChange={selectSingle} />جلسة واحدة</label>
      <label><input type="radio" name={`${group}-mode`} checked={series} onChange={() => setSeries(true)} />سلسلة جلسات</label>
    </div>
    {sessions.map((row, index) => <div className={styles.row} key={row.key}>
      <div className={styles.heading}><strong>الجلسة {index + 1}</strong><div className={styles.tools}>
        <button type="button" title="تحريك لأعلى" aria-label="تحريك لأعلى" disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={18} /></button>
        <button type="button" title="تحريك لأسفل" aria-label="تحريك لأسفل" disabled={index === sessions.length - 1} onClick={() => move(index, 1)}><ArrowDown size={18} /></button>
        <button type="button" title="حذف الجلسة" aria-label="حذف الجلسة" disabled={sessions.length === 1} onClick={() => remove(index)}><Trash2 size={18} /></button>
      </div></div>
      <div className={styles.fields}>
        <label className={styles.title}>اسم الجلسة<input required maxLength={160} value={row.title} onChange={e => setSessions(rows => rows.map((r, i) => i === index ? { ...r, title: e.target.value } : r))} /></label>
        {([['startDate', 'تاريخ البداية', 'date'], ['startTime', 'وقت البداية', 'time'], ['endDate', 'تاريخ النهاية', 'date'], ['endTime', 'وقت النهاية', 'time']] as const).map(([field, label, type]) => <label key={field}>{label}<input type={type} value={row[field] ?? ""} onChange={e => setSessions(rows => rows.map((r, i) => i === index ? { ...r, [field]: e.target.value } : r))} /></label>)}
      </div>
      {!!row.attendanceCount && <p className="muted">{row.attendanceCount} سجل حضور</p>}
    </div>)}
    <div className={styles.footer}>{series && <button type="button" className="ghost-btn" onClick={() => setSessions(rows => [...rows, { key: crypto.randomUUID(), title: `الجلسة ${rows.length + 1}` }])}><Plus size={18} />إضافة جلسة</button>}
      <label>عدد الجلسات المطلوبة للاستحقاق<input type="number" min={1} max={sessions.length} required value={required} onChange={e => setRequired(Number(e.target.value))} /></label>
    </div>
  </section>;
}
