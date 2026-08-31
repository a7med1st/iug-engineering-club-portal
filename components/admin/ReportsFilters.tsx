"use client";

import {
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  FileSliders,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import {
  FormEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import styles from "@/app/admin/reports/reports.module.css";

type DepartmentOption = {
  id: string;
  nameAr: string;
};

type Props = {
  departments: DepartmentOption[];
  selectedDepartmentId: string;
  selectedRange: "ALL" | "30" | "90" | "365";
  selectedStatus:
    | "ALL"
    | "DRAFT"
    | "PUBLISHED"
    | "ARCHIVED";
  memberDepartmentLocked: boolean;
  showReset: boolean;
};

type Option = {
  value: string;
  label: string;
  hint?: string;
};

type DropdownProps = {
  name: string;
  label: string;
  value: string;
  options: Option[];
  icon: "building" | "calendar" | "status";
  disabled?: boolean;
  onChange: (value: string) => void;
};

function Dropdown({
  name,
  label,
  value,
  options,
  icon,
  disabled = false,
  onChange,
}: DropdownProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuStyle, setMenuStyle] = useState({
    top: 0,
    left: 0,
    width: 0,
  });

  const selected =
    options.find((option) => option.value === value) ??
    options[0];

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const menuHeight = Math.min(360, options.length * 58 + 22);
    const roomBelow = window.innerHeight - rect.bottom;
    const shouldOpenAbove =
      roomBelow < menuHeight + 18 && rect.top > menuHeight;

    setMenuStyle({
      top: shouldOpenAbove
        ? Math.max(12, rect.top - menuHeight - 8)
        : rect.bottom + 8,
      left: rect.left,
      width: rect.width,
    });
  };

  useLayoutEffect(() => {
    if (!open) return;

    updatePosition();

    const handleViewport = () => updatePosition();
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("resize", handleViewport);
    window.addEventListener("scroll", handleViewport, true);
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("resize", handleViewport);
      window.removeEventListener("scroll", handleViewport, true);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, options.length]);

  const Icon =
    icon === "building"
      ? Building2
      : icon === "calendar"
        ? CalendarDays
        : FileSliders;

  return (
    <div className={styles.filterField}>
      <label>{label}</label>

      <input type="hidden" name={name} value={value} />

      <button
        ref={triggerRef}
        type="button"
        className={styles.filterTrigger}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((current) => !current);
        }}
      >
        <span className={styles.filterTriggerIcon}>
          <Icon size={18} />
        </span>

        <span className={styles.filterTriggerCopy}>
          <strong>{selected.label}</strong>
          <small>
            {disabled
              ? "القسم محدد حسب صلاحية الحساب"
              : selected.hint ?? "اضغط لاختيار قيمة"}
          </small>
        </span>

        <span
          className={`${styles.filterChevron} ${
            open ? styles.filterChevronOpen : ""
          }`}
        >
          <ChevronDown size={18} />
        </span>
      </button>

      {mounted &&
        open &&
        createPortal(
          <div
            ref={menuRef}
            className={styles.filterMenu}
            role="listbox"
            style={{
              top: menuStyle.top,
              left: menuStyle.left,
              width: menuStyle.width,
            }}
          >
            {options.map((option) => {
              const active = option.value === value;

              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`${styles.filterOption} ${
                    active ? styles.filterOptionActive : ""
                  }`}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <span className={styles.filterOptionMark}>
                    {active ? <Check size={14} /> : null}
                  </span>

                  <span>
                    <strong>{option.label}</strong>
                    {option.hint && <small>{option.hint}</small>}
                  </span>
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}

export default function ReportsFilters({
  departments,
  selectedDepartmentId,
  selectedRange,
  selectedStatus,
  memberDepartmentLocked,
  showReset,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [department, setDepartment] = useState(
    selectedDepartmentId,
  );
  const [range, setRange] = useState(selectedRange);
  const [status, setStatus] = useState(selectedStatus);

  useEffect(() => {
    setDepartment(selectedDepartmentId);
    setRange(selectedRange);
    setStatus(selectedStatus);
  }, [selectedDepartmentId, selectedRange, selectedStatus]);

  const departmentOptions: Option[] = memberDepartmentLocked
    ? departments.map((item) => ({
        value: item.id,
        label: item.nameAr,
        hint: "القسم المسموح لحسابك",
      }))
    : [
        {
          value: "",
          label: "جميع الأقسام",
          hint: "اعرض بيانات النادي كاملة",
        },
        ...departments.map((item) => ({
          value: item.id,
          label: item.nameAr,
          hint: "تصفية النتائج حسب هذا القسم",
        })),
      ];

  const rangeOptions: Option[] = [
    {
      value: "ALL",
      label: "كل الفترات",
      hint: "بدون تقييد زمني",
    },
    {
      value: "30",
      label: "آخر 30 يومًا",
      hint: "البيانات الحديثة",
    },
    {
      value: "90",
      label: "آخر 90 يومًا",
      hint: "آخر ثلاثة أشهر",
    },
    {
      value: "365",
      label: "آخر سنة",
      hint: "آخر 12 شهرًا",
    },
  ];

  const statusOptions: Option[] = [
    {
      value: "ALL",
      label: "جميع الحالات",
      hint: "المسودة والمنشور والمؤرشف",
    },
    {
      value: "DRAFT",
      label: "مسودة",
      hint: "أنشطة لم تنشر بعد",
    },
    {
      value: "PUBLISHED",
      label: "منشور",
      hint: "أنشطة متاحة حاليًا",
    },
    {
      value: "ARCHIVED",
      label: "مؤرشف",
      hint: "أنشطة مؤرشفة",
    },
  ];


  function navigateWithFilters(
    nextDepartment: string,
    nextRange: Props["selectedRange"],
    nextStatus: Props["selectedStatus"],
  ) {
    const query = new URLSearchParams();

    if (nextDepartment) {
      query.set("department", nextDepartment);
    }

    if (nextRange !== "ALL") {
      query.set("range", nextRange);
    }

    if (nextStatus !== "ALL") {
      query.set("status", nextStatus);
    }

    const suffix = query.toString() ? `?${query.toString()}` : "";

    startTransition(() => {
      router.replace(`/admin/reports${suffix}`, {
        scroll: false,
      });
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigateWithFilters(department, range, status);
  }

  function handleReset() {
    const resetDepartment = memberDepartmentLocked
      ? selectedDepartmentId
      : "";

    setDepartment(resetDepartment);
    setRange("ALL");
    setStatus("ALL");

    navigateWithFilters(resetDepartment, "ALL", "ALL");
  }

  return (
    <form
      className={styles.filters}
      onSubmit={handleSubmit}
      data-reveal="up"
    >
      <div className={styles.filtersIntro}>
        <span className={styles.filtersIntroIcon}>
          <SlidersHorizontal size={19} />
        </span>

        <div>
          <strong>تخصيص التقرير</strong>
          <small>اختر القسم والفترة والحالة ثم طبّق الفلاتر.</small>
        </div>
      </div>

      <Dropdown
        name="department"
        label="القسم"
        value={department}
        options={departmentOptions}
        icon="building"
        disabled={memberDepartmentLocked}
        onChange={setDepartment}
      />

      <Dropdown
        name="range"
        label="الفترة"
        value={range}
        options={rangeOptions}
        icon="calendar"
        onChange={(value) =>
          setRange(value as Props["selectedRange"])
        }
      />

      <Dropdown
        name="status"
        label="حالة النشاط"
        value={status}
        options={statusOptions}
        icon="status"
        onChange={(value) =>
          setStatus(value as Props["selectedStatus"])
        }
      />

      <div className={styles.filterActions}>
        <button
          type="submit"
          className={styles.applyButton}
          disabled={isPending}
          aria-busy={isPending}
        >
          <SlidersHorizontal size={17} />
          {isPending ? "جارٍ التطبيق..." : "تطبيق"}
        </button>

        {showReset && (
          <button
            type="button"
            className={styles.reset}
            onClick={handleReset}
            disabled={isPending}
          >
            <RotateCcw size={16} />
            مسح الفلاتر
          </button>
        )}
      </div>
    </form>
  );
}
