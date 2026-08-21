"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

type StatusOption = {
  value: string;
  label: string;
};

type MenuPosition = {
  top: number;
  left: number;
  width: number;
};

export default function ContactStatusSelect({
  name = "status",
  defaultValue,
  options,
}: {
  name?: string;
  defaultValue: string;
  options: StatusOption[];
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const margin = 12;
    const viewportWidth = window.innerWidth;
    const width = Math.min(rect.width, viewportWidth - margin * 2);
    const left = Math.min(
      Math.max(rect.left, margin),
      viewportWidth - width - margin,
    );

    setMenuPosition({
      top: rect.bottom + 8,
      left,
      width,
    });
  }, []);

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
      const clickedTrigger = rootRef.current?.contains(target);
      const clickedMenu = menuRef.current?.contains(target);

      if (!clickedTrigger && !clickedMenu) {
        setOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
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
            className="contact-status-menu contact-status-menu-portal"
            role="listbox"
            aria-label="حالة الطلب"
            dir="rtl"
            style={{
              position: "fixed",
              top: menuPosition.top,
              left: menuPosition.left,
              right: "auto",
              width: menuPosition.width,
              zIndex: 100000,
            }}
          >
            {options.map((option) => {
              const active = option.value === value;

              return (
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  key={option.value}
                  className={`contact-status-option ${active ? "is-active" : ""}`}
                  onClick={() => {
                    setValue(option.value);
                    setOpen(false);
                  }}
                >
                  <span
                    className={`contact-status-dot status-dot-${option.value.toLowerCase()}`}
                  />
                  <span>{option.label}</span>
                  <span className="contact-status-option-check">
                    {active ? <Check size={15} strokeWidth={2.5} /> : null}
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
        className={`contact-status-select ${open ? "is-open" : ""}`}
        ref={rootRef}
      >
        <input type="hidden" name={name} value={value} />

        <button
          ref={triggerRef}
          type="button"
          className="contact-status-trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => {
            if (!open) updateMenuPosition();
            setOpen((current) => !current);
          }}
        >
          <span
            className={`contact-status-dot status-dot-${value.toLowerCase()}`}
          />
          <span className="contact-status-trigger-label">{selected?.label}</span>
          <span className="contact-status-trigger-chevron" aria-hidden="true">
            <ChevronDown size={17} />
          </span>
        </button>
      </div>

      {menu}
    </>
  );
}