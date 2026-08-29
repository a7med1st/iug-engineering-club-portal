"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useCspNonce } from "@/components/security/CspNonce";

type StructureSelectOption = {
  value: string;
  label: string;
  hint?: string;
};

type StructureSelectProps = {
  name: string;
  options: StructureSelectOption[];
  defaultValue?: string;
  placeholder: string;
  required?: boolean;
  allowEmpty?: boolean;
  emptyLabel?: string;
  emptyHint?: string;
  kind?: "account" | "parent";
};

export default function StructureSelect({
  name,
  options,
  defaultValue = "",
  placeholder,
  required = false,
  allowEmpty = false,
  emptyLabel,
  emptyHint,
}: StructureSelectProps) {
  const nonce = useCspNonce();
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };

    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, []);

  const selected = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  );

  const visibleLabel = selected?.label ?? (value === "" && allowEmpty ? emptyLabel : undefined) ?? placeholder;
  const visibleHint = selected?.hint ?? (value === "" && allowEmpty ? emptyHint : undefined);

  return (
    <div
      ref={rootRef}
      className={`structure-select ${open ? "is-open" : ""}`}
      data-structure-select
    >
      <input type="hidden" name={name} value={value} required={required} />

      <button
        type="button"
        className="structure-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="structure-select-copy">
          <strong className={!selected && value === "" && !allowEmpty ? "is-placeholder" : ""}>
            {visibleLabel}
          </strong>
        </span>

        <span className="structure-select-chevron" aria-hidden="true">
          <ChevronDown size={18} />
        </span>
      </button>

      {open && (
        <div className="structure-select-menu" role="listbox">
          {allowEmpty && emptyLabel ? (
            <button
              type="button"
              role="option"
              aria-selected={value === ""}
              className={`structure-select-option ${value === "" ? "is-active" : ""}`}
              onClick={() => {
                setValue("");
                setOpen(false);
              }}
            >
              <span className="structure-select-option-check">
                {value === "" ? <Check size={14} /> : null}
              </span>
              <span className="structure-select-option-copy">
                <strong>{emptyLabel}</strong>
                {emptyHint ? <small>{emptyHint}</small> : null}
              </span>
            </button>
          ) : null}

          {options.map((option) => {
            const active = option.value === value;
            return (
              <button
                type="button"
                role="option"
                aria-selected={active}
                key={option.value}
                className={`structure-select-option ${active ? "is-active" : ""}`}
                onClick={() => {
                  setValue(option.value);
                  setOpen(false);
                }}
              >
                <span className="structure-select-option-check">
                  {active ? <Check size={14} /> : null}
                </span>
                <span className="structure-select-option-copy">
                  <strong>{option.label}</strong>
                  {option.hint ? <small>{option.hint}</small> : null}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <style jsx nonce={nonce}>{`
        .structure-select {
          position: relative;
          width: 100%;
          min-width: 0;
          font-family: "Alexandria", sans-serif;
        }

        .structure-select-trigger {
          width: 100%;
          min-height: 46px;
          padding: 8px 12px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 32px;
          align-items: center;
          gap: 10px;
          border: 1px solid #cbdbea;
          border-radius: 12px;
          background: rgba(255, 255, 255, .94);
          color: #173653;
          cursor: pointer;
          text-align: right;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.96);
          transition:
            border-color .2s ease,
            box-shadow .2s ease,
            background .2s ease;
        }

        .structure-select-trigger:hover {
          border-color: #91c4ef;
          background: #fbfdff;
          box-shadow: 0 7px 18px rgba(22, 136, 255, .075);
        }

        .structure-select.is-open .structure-select-trigger {
          border-color: #1688ff;
          background: #fff;
          box-shadow:
            0 0 0 3px rgba(22, 136, 255, .09),
            0 10px 24px rgba(13, 73, 128, .09);
        }

        .structure-select-copy,
        .structure-select-option-copy {
          min-width: 0;
          display: grid;
          gap: 2px;
        }

        .structure-select-copy strong {
          min-width: 0;
          overflow: hidden;
          color: #18334f;
          font-size: .76rem;
          font-weight: 700;
          line-height: 1.45;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .structure-select-copy strong.is-placeholder {
          color: #8190a2;
          font-weight: 600;
        }

        .structure-select-chevron {
          width: 32px;
          height: 32px;
          display: grid;
          place-items: center;
          border: 1px solid #d7e6f3;
          border-radius: 9px;
          background: #f2f8fe;
          color: #1688ff;
          transition:
            transform .2s ease,
            border-color .2s ease,
            background .2s ease,
            color .2s ease;
        }

        .structure-select.is-open .structure-select-chevron {
          transform: rotate(180deg);
          border-color: transparent;
          background: linear-gradient(135deg, #1688ff, #35d4ff);
          color: #fff;
        }

        .structure-select-menu {
          position: absolute;
          top: calc(100% + 7px);
          inset-inline-start: 0;
          z-index: 999;
          width: max(100%, 320px);
          max-width: min(420px, calc(100vw - 40px));
          max-height: 270px;
          padding: 7px;
          overflow-y: auto;
          overscroll-behavior: contain;
          border: 1px solid #c8dced;
          border-radius: 14px;
          background: rgba(255,255,255,.985);
          box-shadow:
            0 22px 48px rgba(6, 33, 62, .17),
            0 6px 16px rgba(22, 136, 255, .08);
          backdrop-filter: blur(16px);
          animation: structureSelectIn .15s cubic-bezier(.22,1,.36,1) both;
        }

        .structure-select-option {
          width: 100%;
          min-height: 46px;
          padding: 7px 9px;
          display: grid;
          grid-template-columns: 26px minmax(0, 1fr);
          align-items: center;
          gap: 9px;
          border: 1px solid transparent;
          border-radius: 10px;
          background: transparent;
          color: #223f5e;
          cursor: pointer;
          text-align: right;
          transition:
            border-color .16s ease,
            background .16s ease,
            color .16s ease;
        }

        .structure-select-option + .structure-select-option {
          margin-top: 3px;
        }

        .structure-select-option:hover {
          border-color: #d5e7f6;
          background: #f3f9ff;
          color: #0e68bd;
        }

        .structure-select-option.is-active {
          border-color: #a9d3f5;
          background: linear-gradient(135deg, #edf7ff, #effcff);
          color: #0b70d1;
        }

        .structure-select-option-check {
          width: 24px;
          height: 24px;
          display: grid;
          place-items: center;
          border: 1px solid #d7e3ef;
          border-radius: 7px;
          background: #fff;
          color: transparent;
        }

        .structure-select-option.is-active .structure-select-option-check {
          border-color: transparent;
          background: linear-gradient(135deg, #1688ff, #35d4ff);
          color: #fff;
          box-shadow: 0 5px 12px rgba(22, 136, 255, .18);
        }

        .structure-select-option-copy strong {
          color: inherit;
          font-size: .72rem;
          line-height: 1.45;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .structure-select-option-copy small {
          color: #8090a3;
          font-size: .59rem;
          line-height: 1.35;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        @keyframes structureSelectIn {
          from { opacity: 0; transform: translateY(-5px) scale(.992); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @media (max-width: 560px) {
          .structure-select-menu {
            width: 100%;
            max-width: 100%;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .structure-select-trigger,
          .structure-select-chevron,
          .structure-select-option,
          .structure-select-menu {
            animation: none;
            transition: none;
          }
        }
      `}</style>
    </div>
  );
}
