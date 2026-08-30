"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

import styles from "@/app/admin/activities/[id]/registrations/attendance.module.css";

type Option = {
  value: string;
  label: string;
  tone?: "blue" | "green" | "orange" | "red" | "neutral";
};

type MenuPosition = {
  top: number;
  left: number;
  width: number;
};

export default function RegistrationFilterSelect({
  name,
  defaultValue,
  options,
  ariaLabel,
}: {
  name: string;
  defaultValue: string;
  options: Option[];
  ariaLabel: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selected =
    options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const margin = 12;
    const availableWidth = window.innerWidth - margin * 2;
    const width = Math.min(Math.max(rect.width, 210), availableWidth);
    const estimatedMenuHeight = options.length * 47 + 16;
    const spaceBelow = window.innerHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    const left = Math.min(
      Math.max(rect.right - width, margin),
      window.innerWidth - width - margin,
    );
    const top =
      spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow
        ? Math.max(margin, rect.top - estimatedMenuHeight - 8)
        : rect.bottom + 8;

    setMenuPosition({
      top,
      left,
      width,
    });
  }, [options.length]);

  useEffect(() => {
    if (!open) return;

    updateMenuPosition();
    const update = () => updateMenuPosition();

    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    function closeOnOutside(event: PointerEvent) {
      const target = event.target as Node;

      if (
        !rootRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const menu =
    open && mounted && menuPosition
      ? createPortal(
          <div
            ref={menuRef}
            className={styles.filterMenu}
            role="listbox"
            aria-label={ariaLabel}
            dir="rtl"
            style={{
              position: "fixed",
              top: menuPosition.top,
              left: menuPosition.left,
              width: menuPosition.width,
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
                    setValue(option.value);
                    setOpen(false);
                    triggerRef.current?.focus();
                  }}
                >
                  <span
                    className={`${styles.filterDot} ${
                      styles[`filterDot${option.tone ?? "neutral"}`]
                    }`}
                    aria-hidden="true"
                  />
                  <span>{option.label}</span>
                  <span className={styles.filterCheck} aria-hidden="true">
                    {active ? <Check size={15} strokeWidth={2.7} /> : null}
                  </span>
                </button>
              );
            })}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div
        ref={rootRef}
        className={`${styles.filterSelect} ${open ? styles.filterSelectOpen : ""}`}
      >
        <input type="hidden" name={name} value={value} />

        <button
          ref={triggerRef}
          type="button"
          className={styles.filterTrigger}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => {
            if (!open) updateMenuPosition();
            setOpen((current) => !current);
          }}
        >
          <span
            className={`${styles.filterDot} ${
              styles[`filterDot${selected?.tone ?? "neutral"}`]
            }`}
            aria-hidden="true"
          />
          <span className={styles.filterTriggerLabel}>{selected?.label}</span>
          <ChevronDown
            className={styles.filterChevron}
            size={18}
            aria-hidden="true"
          />
        </button>
      </div>

      {menu}
    </>
  );
}
