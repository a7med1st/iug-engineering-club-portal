"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import styles from "./ActivityAttendanceSettings.module.css";

const AttendanceContext = createContext({ enabled: true, setEnabled: (_enabled: boolean) => {} });

export function ActivityAttendanceProvider({ initialEnabled = true, children }: { initialEnabled?: boolean; children: ReactNode }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  return <AttendanceContext.Provider value={{ enabled, setEnabled }}>{children}</AttendanceContext.Provider>;
}

export function useActivityAttendance() {
  return useContext(AttendanceContext);
}

export function ActivityAttendanceMode() {
  const { enabled, setEnabled } = useActivityAttendance();
  return <label className={styles.mode}>نظام النشاط
    <select name="attendanceEnabled" value={String(enabled)} onChange={event => setEnabled(event.target.value === "true")}>
      <option value="true">فعالية بحضور وغياب</option>
      <option value="false">تسجيل فقط (لجان، آراء، طلبات انضمام)</option>
    </select>
  </label>;
}

export function ActivityAttendanceFields({ children }: { children: ReactNode }) {
  const { enabled } = useActivityAttendance();
  return <fieldset hidden={!enabled} disabled={!enabled} className={styles.fields}>{children}</fieldset>;
}

export function ActivityLocationField({ initialLocation = "" }: { initialLocation?: string }) {
  const { enabled } = useActivityAttendance();
  return <label>مكان النشاط{enabled ? " *" : " (اختياري)"}
    <input name="location" required={enabled} maxLength={250} defaultValue={initialLocation} />
  </label>;
}
