"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";

import styles from "@/app/admin/dashboard/dashboard.module.css";

type DepartmentOption = {
  id: string;
  nameAr: string;
};

type DashboardRange = "ALL" | "30" | "90" | "365";

type Props = {
  departments: DepartmentOption[];
  selectedDepartmentId: string | null;
  range: DashboardRange;
};

const RANGE_OPTIONS: Array<{
  value: DashboardRange;
  label: string;
  hint: string;
}> = [
  { value: "ALL", label: "كل الفترات", hint: "عرض البيانات التاريخية كاملة" },
  { value: "30", label: "آخر 30 يومًا", hint: "متابعة الأداء القريب" },
  { value: "90", label: "آخر 90 يومًا", hint: "نظرة على الربع الأخير" },
  { value: "365", label: "آخر سنة", hint: "ملخص أداء سنوي" },
];

export default function DashboardFilters({
  departments,
  selectedDepartmentId,
  range,
}: Props) {
  const rootRef = useRef<HTMLFormElement | null>(null);
  const [departmentId, setDepartmentId] = useState(selectedDepartmentId ?? "");
  const [selectedRange, setSelectedRange] = useState<DashboardRange>(range);
  const [openMenu, setOpenMenu] = useState<"department" | "range" | null>(null);

  useEffect(() => {
    function closeOnOutside(event: PointerEvent) {
      const target = event.target as Node | null;
      if (target && !rootRef.current?.contains(target)) {
        setOpenMenu(null);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenMenu(null);
    }

    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const selectedDepartment = departments.find((item) => item.id === departmentId);
  const selectedRangeOption =
    RANGE_OPTIONS.find((item) => item.value === selectedRange) ?? RANGE_OPTIONS[0];
  const hasFilters = Boolean(departmentId) || selectedRange !== "ALL";

  return (
    <form
      ref={rootRef}
      method="get"
      className={styles.filters}
      data-reveal="up"
    >
      <input type="hidden" name="department" value={departmentId} />
      <input type="hidden" name="range" value={selectedRange} />

      <div className={styles.filterHeading}>
        <span className={styles.filterHeadingIcon}>
          <SlidersHorizontal size={18} aria-hidden="true" />
        </span>
        <div>
          <strong>تخصيص الإحصائيات</strong>
          <small>اختر القسم والفترة ثم طبّق التغييرات.</small>
        </div>
      </div>

      <div className={styles.filterControl}>
        <span className={styles.filterLabel}>القسم</span>
        <div className={styles.dropdown}>
          <button
            type="button"
            className={`${styles.dropdownTrigger} ${
              openMenu === "department" ? styles.dropdownTriggerOpen : ""
            }`}
            aria-haspopup="listbox"
            aria-expanded={openMenu === "department"}
            onClick={() =>
              setOpenMenu((current) =>
                current === "department" ? null : "department",
              )
            }
          >
            <span className={styles.dropdownLeadIcon}>
              <Building2 size={18} aria-hidden="true" />
            </span>
            <span className={styles.dropdownTriggerText}>
              <strong>{selectedDepartment?.nameAr ?? "جميع الأقسام"}</strong>
              <small>
                {selectedDepartment
                  ? "عرض البيانات الخاصة بهذا القسم"
                  : "عرض بيانات النادي بالكامل"}
              </small>
            </span>
            <span className={styles.dropdownChevron}>
              <ChevronDown size={18} aria-hidden="true" />
            </span>
          </button>

          {openMenu === "department" && (
            <div className={styles.dropdownMenu} role="listbox" aria-label="القسم">
              <button
                type="button"
                role="option"
                aria-selected={!departmentId}
                className={`${styles.dropdownOption} ${
                  !departmentId ? styles.dropdownOptionActive : ""
                }`}
                onClick={() => {
                  setDepartmentId("");
                  setOpenMenu(null);
                }}
              >
                <span className={styles.dropdownOptionMark}>
                  {!departmentId ? <Check size={15} /> : null}
                </span>
                <span>
                  <strong>جميع الأقسام</strong>
                  <small>إحصائيات النادي كاملة</small>
                </span>
              </button>

              {departments.map((department) => {
                const active = department.id === departmentId;
                return (
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`${styles.dropdownOption} ${
                      active ? styles.dropdownOptionActive : ""
                    }`}
                    key={department.id}
                    onClick={() => {
                      setDepartmentId(department.id);
                      setOpenMenu(null);
                    }}
                  >
                    <span className={styles.dropdownOptionMark}>
                      {active ? <Check size={15} /> : null}
                    </span>
                    <span>
                      <strong>{department.nameAr}</strong>
                      <small>تصفية النتائج حسب القسم</small>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className={styles.filterControl}>
        <span className={styles.filterLabel}>الفترة الإحصائية</span>
        <div className={styles.dropdown}>
          <button
            type="button"
            className={`${styles.dropdownTrigger} ${
              openMenu === "range" ? styles.dropdownTriggerOpen : ""
            }`}
            aria-haspopup="listbox"
            aria-expanded={openMenu === "range"}
            onClick={() =>
              setOpenMenu((current) => (current === "range" ? null : "range"))
            }
          >
            <span className={styles.dropdownLeadIcon}>
              <CalendarDays size={18} aria-hidden="true" />
            </span>
            <span className={styles.dropdownTriggerText}>
              <strong>{selectedRangeOption.label}</strong>
              <small>{selectedRangeOption.hint}</small>
            </span>
            <span className={styles.dropdownChevron}>
              <ChevronDown size={18} aria-hidden="true" />
            </span>
          </button>

          {openMenu === "range" && (
            <div className={styles.dropdownMenu} role="listbox" aria-label="الفترة">
              {RANGE_OPTIONS.map((item) => {
                const active = item.value === selectedRange;
                return (
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`${styles.dropdownOption} ${
                      active ? styles.dropdownOptionActive : ""
                    }`}
                    key={item.value}
                    onClick={() => {
                      setSelectedRange(item.value);
                      setOpenMenu(null);
                    }}
                  >
                    <span className={styles.dropdownOptionMark}>
                      {active ? <Check size={15} /> : null}
                    </span>
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.hint}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className={styles.filterActions}>
        <button type="submit" className={styles.applyButton}>
          <SlidersHorizontal size={17} aria-hidden="true" />
          تطبيق
        </button>

        {hasFilters && (
          <Link href="/admin/dashboard" className={styles.reset}>
            <RotateCcw size={16} aria-hidden="true" />
            مسح الفلاتر
          </Link>
        )}
      </div>
    </form>
  );
}
