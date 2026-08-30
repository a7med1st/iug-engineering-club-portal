"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { format } from "date-fns";
import { CalendarDays, Check, ChevronDown, ChevronUp, Clock3, X } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { ar } from "react-day-picker/locale";
import "react-day-picker/style.css";

import styles from "./ActivitySchedulePicker.module.css";

type PickerName = "startDate" | "startTime" | "endDate" | "endTime";

type Props = {
  initialStartDate?: string;
  initialStartTime?: string;
  initialEndDate?: string;
  initialEndTime?: string;
  compact?: boolean;
};

const pickerLabels: Record<PickerName, string> = {
  startDate: "تاريخ البداية",
  startTime: "وقت البداية",
  endDate: "تاريخ النهاية",
  endTime: "وقت النهاية",
};

const timePresets = ["09:00", "10:00", "12:00", "14:00", "16:00", "18:00"];

function parseDateValue(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function displayDate(value: string) {
  const date = parseDateValue(value);
  return date
    ? new Intl.DateTimeFormat("ar-PS", { dateStyle: "medium" }).format(date)
    : "اختر التاريخ";
}

function displayTime(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return "اختر الوقت";

  const date = new Date(2000, 0, 1, Number(match[1]), Number(match[2]));
  return new Intl.DateTimeFormat("ar-PS", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function normalizeTime(value: string) {
  return /^\d{2}:\d{2}$/.test(value) ? value : "09:00";
}

function adjustTime(value: string, part: "hour" | "minute", amount: number) {
  const [currentHour, currentMinute] = normalizeTime(value).split(":").map(Number);
  const totalMinutes = ((currentHour * 60 + currentMinute + (part === "hour" ? amount * 60 : amount)) % 1440 + 1440) % 1440;
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export default function ActivitySchedulePicker({
  initialStartDate = "",
  initialStartTime = "",
  initialEndDate = "",
  initialEndTime = "",
  compact = false,
}: Props) {
  const titleId = useId();
  const [values, setValues] = useState<Record<PickerName, string>>({
    startDate: initialStartDate,
    startTime: initialStartTime,
    endDate: initialEndDate,
    endTime: initialEndTime,
  });
  const [openPicker, setOpenPicker] = useState<PickerName | null>(null);
  const [draftTime, setDraftTime] = useState("09:00");
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalTarget(document.getElementById("app-portal-root"));
  }, []);

  const selectedDate = useMemo(
    () => openPicker && openPicker.endsWith("Date")
      ? parseDateValue(values[openPicker])
      : undefined,
    [openPicker, values],
  );

  function open(name: PickerName) {
    if (name.endsWith("Time")) {
      setDraftTime(normalizeTime(values[name]));
    }
    setOpenPicker(name);
  }

  function update(name: PickerName, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  const optionalPicker = openPicker === "endDate" || openPicker === "endTime";

  return (
    <section
      className={`${styles.schedule} ${compact ? styles.compact : ""}`}
      aria-labelledby={compact ? undefined : titleId}
      dir="rtl"
    >
      {!compact && (
        <header className={styles.heading}>
          <h3 id={titleId}>موعد النشاط</h3>
          <p>حدد البداية، ويمكنك إضافة موعد نهاية اختياري أو تعديله لاحقًا.</p>
        </header>
      )}

      {(Object.keys(values) as PickerName[]).map((name) => {
        const isDate = name.endsWith("Date");
        const optional = name.startsWith("end");
        const value = values[name];

        return (
          <div className={styles.field} key={name}>
            <div className={styles.fieldLabel}>
              <span>{pickerLabels[name]}</span>
              <small>{optional ? "اختياري" : "مطلوب"}</small>
            </div>

            <button
              type="button"
              className={`${styles.trigger} ${value ? styles.hasValue : ""}`}
              onClick={() => open(name)}
              aria-haspopup="dialog"
              aria-expanded={openPicker === name}
            >
              {isDate ? <CalendarDays size={18} /> : <Clock3 size={18} />}
              <span>{isDate ? displayDate(value) : displayTime(value)}</span>
              <ChevronDown size={17} className={styles.triggerChevron} />
            </button>

            <input type="hidden" name={name} value={value} />
          </div>
        );
      })}

      {openPicker && portalTarget && createPortal(
        <div className={styles.portalLayer} onMouseDown={() => setOpenPicker(null)}>
          <div
            className={styles.popover}
            role="dialog"
            aria-modal="true"
            aria-label={`اختيار ${pickerLabels[openPicker]}`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.popoverHead}>
              <div>
                <strong>{pickerLabels[openPicker]}</strong>
              </div>
              <button
                type="button"
                onClick={() => setOpenPicker(null)}
                aria-label="إغلاق نافذة الاختيار"
                title="إغلاق"
              >
                <X size={18} />
              </button>
            </div>

            {openPicker.endsWith("Date") ? (
              <DayPicker
                mode="single"
                dir="rtl"
                locale={ar}
                weekStartsOn={6}
                navLayout="around"
                showOutsideDays
                selected={selectedDate}
                defaultMonth={selectedDate}
                onSelect={(date) => {
                  if (!date) return;
                  update(openPicker, format(date, "yyyy-MM-dd"));
                  setOpenPicker(null);
                }}
              />
            ) : (
              <div className={styles.timePicker}>
                <div className={styles.timeUnits} dir="ltr">
                  <div className={styles.timeUnit}>
                    <button type="button" onClick={() => setDraftTime((value) => adjustTime(value, "hour", 1))} aria-label="زيادة الساعة">
                      <ChevronUp size={18} />
                    </button>
                    <strong>{draftTime.slice(0, 2)}</strong>
                    <small>ساعة</small>
                    <button type="button" onClick={() => setDraftTime((value) => adjustTime(value, "hour", -1))} aria-label="تقليل الساعة">
                      <ChevronDown size={18} />
                    </button>
                  </div>

                  <span className={styles.timeSeparator}>:</span>

                  <div className={styles.timeUnit}>
                    <button type="button" onClick={() => setDraftTime((value) => adjustTime(value, "minute", 5))} aria-label="زيادة الدقائق">
                      <ChevronUp size={18} />
                    </button>
                    <strong>{draftTime.slice(3, 5)}</strong>
                    <small>دقيقة</small>
                    <button type="button" onClick={() => setDraftTime((value) => adjustTime(value, "minute", -5))} aria-label="تقليل الدقائق">
                      <ChevronDown size={18} />
                    </button>
                  </div>
                </div>

                <div className={styles.presets} dir="ltr">
                  {timePresets.map((time) => (
                    <button
                      type="button"
                      key={time}
                      className={draftTime === time ? styles.presetActive : ""}
                      onClick={() => setDraftTime(time)}
                    >
                      {time}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  className={styles.confirmButton}
                  onClick={() => {
                    update(openPicker, draftTime);
                    setOpenPicker(null);
                  }}
                >
                  <Check size={17} />
                  اعتماد الوقت
                </button>
              </div>
            )}

            {optionalPicker && values[openPicker] && (
              <button
                type="button"
                className={styles.clearButton}
                onClick={() => {
                  setValues((current) => ({
                    ...current,
                    endDate: "",
                    endTime: "",
                  }));
                  setOpenPicker(null);
                }}
              >
                مسح موعد النهاية
              </button>
            )}
          </div>
        </div>,
        portalTarget,
      )}
    </section>
  );
}
