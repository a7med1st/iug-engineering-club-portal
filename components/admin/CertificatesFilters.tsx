"use client";

import {
  Award,
  Check,
  ChevronDown,
  FileCheck2,
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

import styles from "@/app/admin/certificates/certificates.module.css";

type ActivityOption = {
  id: string;
  title: string;
};

type Props = {
  activities: ActivityOption[];
  selectedActivityId: string;
  selectedIssued:
    | "ALL"
    | "ISSUED"
    | "NOT_ISSUED";
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
  icon: "activity" | "issued";
  onChange: (value: string) => void;
};

function Dropdown({
  name,
  label,
  value,
  options,
  icon,
  onChange,
}: DropdownProps) {
  const triggerRef =
    useRef<HTMLButtonElement>(null);
  const menuRef =
    useRef<HTMLDivElement>(null);

  const [open, setOpen] =
    useState(false);
  const [mounted, setMounted] =
    useState(false);
  const [menuStyle, setMenuStyle] =
    useState({
      top: 0,
      left: 0,
      width: 0,
    });

  const selected =
    options.find(
      (option) =>
        option.value === value,
    ) ?? options[0];

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = () => {
    const trigger =
      triggerRef.current;

    if (!trigger) return;

    const rect =
      trigger.getBoundingClientRect();

    const menuHeight =
      Math.min(
        360,
        options.length * 58 + 22,
      );

    const roomBelow =
      window.innerHeight -
      rect.bottom;

    const shouldOpenAbove =
      roomBelow <
        menuHeight + 18 &&
      rect.top > menuHeight;

    setMenuStyle({
      top: shouldOpenAbove
        ? Math.max(
            12,
            rect.top -
              menuHeight -
              8,
          )
        : rect.bottom + 8,
      left: rect.left,
      width: rect.width,
    });
  };

  useLayoutEffect(() => {
    if (!open) return;

    updatePosition();

    const handleViewport = () =>
      updatePosition();

    const handlePointerDown = (
      event: PointerEvent,
    ) => {
      const target =
        event.target as Node;

      if (
        !triggerRef.current?.contains(
          target,
        ) &&
        !menuRef.current?.contains(
          target,
        )
      ) {
        setOpen(false);
      }
    };

    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener(
      "resize",
      handleViewport,
    );
    window.addEventListener(
      "scroll",
      handleViewport,
      true,
    );
    document.addEventListener(
      "pointerdown",
      handlePointerDown,
    );
    document.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        "resize",
        handleViewport,
      );
      window.removeEventListener(
        "scroll",
        handleViewport,
        true,
      );
      document.removeEventListener(
        "pointerdown",
        handlePointerDown,
      );
      document.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [open, options.length]);

  const Icon =
    icon === "activity"
      ? Award
      : FileCheck2;

  return (
    <div className={styles.filterField}>
      <label>{label}</label>

      <input
        type="hidden"
        name={name}
        value={value}
      />

      <button
        ref={triggerRef}
        type="button"
        className={
          styles.filterTrigger
        }
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() =>
          setOpen(
            (current) => !current,
          )
        }
      >
        <span
          className={
            styles.filterTriggerIcon
          }
        >
          <Icon size={18} />
        </span>

        <span
          className={
            styles.filterTriggerCopy
          }
        >
          <strong>
            {selected.label}
          </strong>

          <small>
            {selected.hint ??
              "اضغط للاختيار"}
          </small>
        </span>

        <span
          className={`${styles.filterChevron} ${
            open
              ? styles.filterChevronOpen
              : ""
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
            className={
              styles.filterMenu
            }
            role="listbox"
            style={{
              top: menuStyle.top,
              left: menuStyle.left,
              width: menuStyle.width,
            }}
          >
            {options.map(
              (option) => {
                const active =
                  option.value === value;

                return (
                  <button
                    key={
                      option.value
                    }
                    type="button"
                    role="option"
                    aria-selected={
                      active
                    }
                    className={`${styles.filterOption} ${
                      active
                        ? styles.filterOptionActive
                        : ""
                    }`}
                    onClick={() => {
                      onChange(
                        option.value,
                      );
                      setOpen(false);
                    }}
                  >
                    <span
                      className={
                        styles.filterOptionMark
                      }
                    >
                      {active ? (
                        <Check
                          size={14}
                        />
                      ) : null}
                    </span>

                    <span>
                      <strong>
                        {option.label}
                      </strong>

                      {option.hint && (
                        <small>
                          {option.hint}
                        </small>
                      )}
                    </span>
                  </button>
                );
              },
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

export default function CertificatesFilters({
  activities,
  selectedActivityId,
  selectedIssued,
  showReset,
}: Props) {
  const router = useRouter();

  const [
    isPending,
    startTransition,
  ] = useTransition();

  const [activity, setActivity] =
    useState(
      selectedActivityId,
    );

  const [issued, setIssued] =
    useState(selectedIssued);

  useEffect(() => {
    setActivity(
      selectedActivityId,
    );
  }, [selectedActivityId]);

  useEffect(() => {
    setIssued(selectedIssued);
  }, [selectedIssued]);

  const activityOptions: Option[] =
    [
      {
        value: "",
        label: "جميع الأنشطة",
        hint: "عرض كل الأنشطة المؤهلة",
      },
      ...activities.map(
        (item) => ({
          value: item.id,
          label: item.title,
          hint: "تصفية حسب هذا النشاط",
        }),
      ),
    ];

  const issuedOptions: Option[] =
    [
      {
        value: "ALL",
        label: "كل الحالات",
        hint: "الصادرة وغير الصادرة",
      },
      {
        value: "ISSUED",
        label: "صدرت",
        hint: "الشهادات الفعالة",
      },
      {
        value: "NOT_ISSUED",
        label: "لم تصدر",
        hint: "بانتظار الإصدار",
      },
    ];

  function navigate(
    nextActivity: string,
    nextIssued:
      | "ALL"
      | "ISSUED"
      | "NOT_ISSUED",
  ) {
    const query =
      new URLSearchParams();

    if (nextActivity) {
      query.set(
        "activity",
        nextActivity,
      );
    }

    if (nextIssued !== "ALL") {
      query.set(
        "issued",
        nextIssued,
      );
    }

    const suffix =
      query.toString()
        ? `?${query.toString()}`
        : "";

    startTransition(() => {
      router.replace(
        `/admin/certificates${suffix}`,
        {
          scroll: false,
        },
      );
    });
  }

  function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    navigate(
      activity,
      issued,
    );
  }

  function handleReset() {
    setActivity("");
    setIssued("ALL");

    navigate("", "ALL");
  }

  return (
    <form
      className={styles.filters}
      onSubmit={handleSubmit}
    >
      <div
        className={
          styles.filtersIntro
        }
      >
        <span
          className={
            styles.filtersIntroIcon
          }
        >
          <SlidersHorizontal
            size={19}
          />
        </span>

        <div>
          <strong>
            تصفية الشهادات
          </strong>

          <small>
            اختر النشاط وحالة
            الشهادة ثم طبّق.
          </small>
        </div>
      </div>

      <Dropdown
        name="activity"
        label="النشاط"
        value={activity}
        options={
          activityOptions
        }
        icon="activity"
        onChange={setActivity}
      />

      <Dropdown
        name="issued"
        label="حالة الشهادة"
        value={issued}
        options={
          issuedOptions
        }
        icon="issued"
        onChange={(value) =>
          setIssued(
            value as Props["selectedIssued"],
          )
        }
      />

      <div
        className={
          styles.filterActions
        }
      >
        <button
          type="submit"
          className={
            styles.applyButton
          }
          disabled={isPending}
          aria-busy={isPending}
        >
          <SlidersHorizontal
            size={17}
          />

          {isPending
            ? "جارٍ التطبيق..."
            : "تطبيق"}
        </button>

        {showReset && (
          <button
            type="button"
            className={
              styles.reset
            }
            onClick={handleReset}
            disabled={isPending}
          >
            <RotateCcw
              size={16}
            />

            مسح الفلاتر
          </button>
        )}
      </div>
    </form>
  );
}