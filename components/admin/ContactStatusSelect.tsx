"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronDown,
} from "lucide-react";

import styles from "./ContactStatusSelect.module.css";

type StatusOption = {
  value: string;
  label: string;
};

type MenuPosition = {
  top: number;
  left: number;
  width: number;
};

function statusClass(
  value: string,
) {
  switch (value) {
    case "NEW":
      return styles.statusNew;

    case "IN_REVIEW":
      return styles.statusReview;

    case "IN_PROGRESS":
      return styles.statusProgress;

    case "RESOLVED":
      return styles.statusResolved;

    default:
      return styles.statusDefault;
  }
}

export default function ContactStatusSelect({
  name = "status",
  defaultValue,
  options,
}: {
  name?: string;
  defaultValue: string;
  options: StatusOption[];
}) {
  const [value, setValue] =
    useState(defaultValue);
  const [open, setOpen] =
    useState(false);
  const [mounted, setMounted] =
    useState(false);
  const [
    menuPosition,
    setMenuPosition,
  ] =
    useState<MenuPosition | null>(
      null,
    );

  const rootRef =
    useRef<HTMLDivElement>(null);
  const triggerRef =
    useRef<HTMLButtonElement>(null);
  const menuRef =
    useRef<HTMLDivElement>(null);

  const selected =
    options.find(
      (option) =>
        option.value === value,
    ) ?? options[0];

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  const updateMenuPosition =
    useCallback(() => {
      const trigger =
        triggerRef.current;

      if (!trigger) return;

      const rect =
        trigger.getBoundingClientRect();

      const margin = 12;
      const gap = 8;
      const viewportWidth =
        window.innerWidth;
      const viewportHeight =
        window.innerHeight;

      const width = Math.min(
        Math.max(rect.width, 230),
        viewportWidth -
          margin * 2,
      );

      const left = Math.min(
        Math.max(
          rect.right - width,
          margin,
        ),
        viewportWidth -
          width -
          margin,
      );

      const estimatedMenuHeight =
        options.length * 48 + 16;

      const spaceBelow =
        viewportHeight -
        rect.bottom -
        margin;

      const shouldOpenAbove =
        spaceBelow <
          estimatedMenuHeight &&
        rect.top >
          estimatedMenuHeight;

      const top = shouldOpenAbove
        ? Math.max(
            margin,
            rect.top -
              estimatedMenuHeight -
              gap,
          )
        : rect.bottom + gap;

      setMenuPosition({
        top,
        left,
        width,
      });
    }, [options.length]);

  useEffect(() => {
    if (!open) return;

    updateMenuPosition();

    const update = () =>
      updateMenuPosition();

    window.addEventListener(
      "resize",
      update,
    );
    window.addEventListener(
      "scroll",
      update,
      true,
    );

    return () => {
      window.removeEventListener(
        "resize",
        update,
      );
      window.removeEventListener(
        "scroll",
        update,
        true,
      );
    };
  }, [
    open,
    updateMenuPosition,
  ]);

  useEffect(() => {
    function closeOnOutside(
      event: PointerEvent,
    ) {
      const target =
        event.target as Node;

      const clickedTrigger =
        rootRef.current?.contains(
          target,
        );

      const clickedMenu =
        menuRef.current?.contains(
          target,
        );

      if (
        !clickedTrigger &&
        !clickedMenu
      ) {
        setOpen(false);
      }
    }

    function closeOnEscape(
      event: KeyboardEvent,
    ) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener(
      "pointerdown",
      closeOnOutside,
    );
    document.addEventListener(
      "keydown",
      closeOnEscape,
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        closeOnOutside,
      );
      document.removeEventListener(
        "keydown",
        closeOnEscape,
      );
    };
  }, []);

  const selectedTone =
    statusClass(value);

  const menu =
    open &&
    mounted &&
    menuPosition
      ? createPortal(
          <div
            ref={menuRef}
            className={
              styles.menu
            }
            role="listbox"
            aria-label="حالة الطلب"
            dir="rtl"
            style={{
              position: "fixed",
              top: menuPosition.top,
              left: menuPosition.left,
              width:
                menuPosition.width,
              zIndex: 100000,
            }}
          >
            {options.map(
              (option) => {
                const active =
                  option.value ===
                  value;

                const tone =
                  statusClass(
                    option.value,
                  );

                return (
                  <button
                    type="button"
                    role="option"
                    aria-selected={
                      active
                    }
                    key={
                      option.value
                    }
                    className={[
                      styles.option,
                      active
                        ? styles.optionActive
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => {
                      setValue(
                        option.value,
                      );
                      setOpen(false);
                    }}
                  >
                    <span
                      className={[
                        styles.dot,
                        tone,
                      ].join(" ")}
                      aria-hidden="true"
                    />

                    <span
                      className={
                        styles.optionLabel
                      }
                    >
                      {option.label}
                    </span>

                    <span
                      className={
                        styles.check
                      }
                      aria-hidden="true"
                    >
                      {active ? (
                        <Check
                          size={15}
                          strokeWidth={
                            2.6
                          }
                        />
                      ) : null}
                    </span>
                  </button>
                );
              },
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div
        ref={rootRef}
        className={`contact-status-select ${
          open ? "is-open" : ""
        } ${styles.root}`}
      >
        <input
          type="hidden"
          name={name}
          value={value}
        />

        <button
          ref={triggerRef}
          type="button"
          className={[
            styles.trigger,
            open
              ? styles.triggerOpen
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => {
            if (!open) {
              updateMenuPosition();
            }

            setOpen(
              (current) =>
                !current,
            );
          }}
        >
          <span
            className={[
              styles.dot,
              selectedTone,
            ].join(" ")}
            aria-hidden="true"
          />

          <span
            className={
              styles.triggerLabel
            }
          >
            {selected?.label}
          </span>

          <span
            className={
              styles.chevron
            }
            aria-hidden="true"
          >
            <ChevronDown
              size={17}
              strokeWidth={2}
            />
          </span>
        </button>
      </div>

      {menu}
    </>
  );
}
