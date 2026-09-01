"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, Check, ChevronDown } from "lucide-react";

import { useCspNonce } from "@/components/security/CspNonce";

type DepartmentOption = {
  id: string;
  nameAr: string;
};

type DepartmentSelectProps = {
  name?: string;
  departments: DepartmentOption[];
  defaultValue?: string;
  placeholder?: string;
};

export default function DepartmentSelect({
  name = "departmentId",
  departments,
  defaultValue = "",
  placeholder = "بدون قسم",
}: DepartmentSelectProps) {
  const nonce = useCspNonce();
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const options = useMemo(
    () => [{ id: "", nameAr: placeholder }, ...departments],
    [departments, placeholder],
  );

  const selected =
    options.find((option) => option.id === value) ?? options[0];

  useEffect(() => {
    function handleOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handleOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={`members-department-select ${open ? "is-open" : ""}`}
    >
      <input type="hidden" name={name} value={value} />

      <button
        type="button"
        className="members-department-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="members-department-selected">
          <span className="members-department-icon" aria-hidden="true">
            <Building2 size={18} />
          </span>

          <span className="members-department-selected-copy">
            <strong>{selected.nameAr}</strong>
            <small>
              {selected.id ? "القسم المرتبط بحساب العضو" : "عضو بدون قسم محدد"}
            </small>
          </span>
        </span>

        <span className="members-department-chevron" aria-hidden="true">
          <ChevronDown size={20} />
        </span>
      </button>

      {open && (
        <div
          className="members-department-menu"
          role="listbox"
          aria-label="اختيار القسم"
        >
          <div className="members-department-menu-head">
            <span>اختر القسم المسؤول عنه</span>
            <small>{departments.length} أقسام متاحة</small>
          </div>

          <div className="members-department-options">
            {options.map((option) => {
              const active = option.id === value;

              return (
                <button
                  key={option.id || "no-department"}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`members-department-option ${
                    active ? "is-active" : ""
                  }`}
                  onClick={() => {
                    setValue(option.id);
                    setOpen(false);
                  }}
                >
                  <span className="members-department-option-icon">
                    <Building2 size={17} />
                  </span>

                  <span className="members-department-option-copy">
                    <strong>{option.nameAr}</strong>
                    <small>
                      {option.id
                        ? "ربط صلاحيات القسم بهذا العضو"
                        : "بدون تقييد العضو بقسم معين"}
                    </small>
                  </span>

                  <span className="members-department-check" aria-hidden="true">
                    {active ? <Check size={16} /> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <style nonce={nonce} suppressHydrationWarning>{`
        .members-department-select {
          position: relative;
          width: 100%;
          direction: rtl;
          font-family: "Alexandria", sans-serif;
        }

        .members-department-trigger {
          width: 100%;
          height: 54px;
          min-height: 54px;
          padding: 7px 10px 7px 11px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border: 1px solid #c8dced;
          border-radius: 14px;
          background:
            linear-gradient(180deg, rgba(255,255,255,.98), rgba(247,251,255,.96));
          color: #102139;
          cursor: pointer;
          text-align: right;
          box-shadow:
            0 6px 18px rgba(8,46,84,.045),
            inset 0 1px 0 rgba(255,255,255,.95);
          transition:
            transform .22s ease,
            border-color .22s ease,
            background .22s ease,
            box-shadow .22s ease;
        }

        .members-department-trigger:hover {
          transform: translateY(-1px);
          border-color: #8cc2f2;
          background:
            linear-gradient(135deg, #fff 0%, #f1f8ff 58%, #eefcff 100%);
          box-shadow:
            0 10px 24px rgba(22,136,255,.11),
            0 0 0 3px rgba(22,136,255,.045);
        }

        .members-department-select.is-open .members-department-trigger {
          border-color: var(--members-blue, #1688ff);
          background: #fff;
          box-shadow:
            0 0 0 4px rgba(22,136,255,.10),
            0 13px 30px rgba(10,74,132,.12);
        }

        .members-department-selected {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .members-department-icon {
          flex: 0 0 auto;
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(22,136,255,.14);
          border-radius: 11px;
          background: linear-gradient(135deg, #edf7ff, #edfcff);
          color: #1688ff;
          transition: transform .22s ease, background .22s ease, color .22s ease;
        }

        .members-department-trigger:hover .members-department-icon,
        .members-department-select.is-open .members-department-icon {
          transform: scale(1.04);
          border-color: transparent;
          background: linear-gradient(135deg, #1688ff, #35d4ff);
          color: #fff;
          box-shadow: 0 7px 16px rgba(22,136,255,.20);
        }

        .members-department-selected-copy {
          min-width: 0;
          display: grid;
          gap: 2px;
        }

        .members-department-selected-copy strong {
          color: #102139;
          font-size: .79rem;
          font-weight: 700;
          line-height: 1.55;
        }

        .members-department-selected-copy small {
          color: #78899c;
          font-family: "Alexandria", sans-serif;
          font-size: .72rem;
          line-height: 1.35;
        }

        .members-department-chevron {
          flex: 0 0 auto;
          width: 32px;
          height: 32px;
          display: grid;
          place-items: center;
          border-radius: 9px;
          background: #edf6ff;
          color: #147bdc;
          transition: transform .22s ease, background .22s ease, color .22s ease;
        }

        .members-department-select.is-open .members-department-chevron {
          transform: rotate(180deg);
          background: linear-gradient(135deg, #1688ff, #35d4ff);
          color: #fff;
        }

        .members-department-menu {
          position: absolute;
          top: calc(100% + 8px);
          inset-inline: 0;
          z-index: 140;
          max-height: 370px;
          overflow: auto;
          padding: 8px;
          border: 1px solid rgba(177,205,233,.92);
          border-radius: 18px;
          background:
            radial-gradient(circle at 92% 0%, rgba(22,136,255,.12), transparent 35%),
            radial-gradient(circle at 8% 100%, rgba(53,212,255,.08), transparent 32%),
            linear-gradient(180deg, rgba(255,255,255,.995), rgba(247,251,255,.99));
          box-shadow:
            0 26px 60px rgba(5,31,61,.22),
            0 7px 20px rgba(22,136,255,.09);
          backdrop-filter: blur(18px);
          animation: membersDepartmentMenuIn .18s cubic-bezier(.22,1,.36,1) both;
        }

        .members-department-menu-head {
          padding: 8px 10px 11px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border-bottom: 1px solid rgba(205,220,235,.72);
        }

        .members-department-menu-head span {
          color: #244664;
          font-size: .7rem;
          font-weight: 700;
        }

        .members-department-menu-head small {
          padding: 4px 8px;
          border-radius: 999px;
          background: #edf7ff;
          color: #1688ff;
          font-size: .6rem;
          white-space: nowrap;
        }

        .members-department-options {
          display: grid;
          gap: 5px;
          padding-top: 7px;
        }

        .members-department-option {
          width: 100%;
          min-height: 58px;
          padding: 8px 9px;
          display: grid;
          grid-template-columns: 36px minmax(0, 1fr) 30px;
          align-items: center;
          gap: 10px;
          border: 1px solid transparent;
          border-radius: 13px;
          background: transparent;
          color: #17334f;
          cursor: pointer;
          text-align: right;
          transition:
            transform .18s ease,
            border-color .18s ease,
            background .18s ease,
            box-shadow .18s ease;
        }

        .members-department-option:hover {
          transform: translateX(-2px);
          border-color: rgba(22,136,255,.15);
          background: linear-gradient(90deg, #eef8ff, #f8fcff);
          box-shadow: 0 8px 19px rgba(22,136,255,.07);
        }

        .members-department-option.is-active {
          border-color: rgba(22,136,255,.24);
          background:
            linear-gradient(135deg, rgba(22,136,255,.12), rgba(53,212,255,.08));
        }

        .members-department-option-icon {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border: 1px solid #d9e6f1;
          border-radius: 10px;
          background: rgba(255,255,255,.86);
          color: #6d8baa;
        }

        .members-department-option.is-active .members-department-option-icon {
          border-color: transparent;
          background: linear-gradient(135deg, #1688ff, #35d4ff);
          color: #fff;
          box-shadow: 0 7px 15px rgba(22,136,255,.18);
        }

        .members-department-option-copy {
          min-width: 0;
          display: grid;
          gap: 2px;
        }

        .members-department-option-copy strong {
          color: #17334f;
          font-size: .76rem;
          font-weight: 700;
          line-height: 1.5;
        }

        .members-department-option-copy small {
          color: #7a8b9f;
          font-family: "Alexandria", sans-serif;
          font-size: .69rem;
          line-height: 1.35;
        }

        .members-department-check {
          width: 28px;
          height: 28px;
          display: grid;
          place-items: center;
          border-radius: 9px;
          color: #fff;
        }

        .members-department-option.is-active .members-department-check {
          background: linear-gradient(135deg, #1688ff, #35d4ff);
          box-shadow: 0 6px 14px rgba(22,136,255,.19);
        }

        @keyframes membersDepartmentMenuIn {
          from {
            opacity: 0;
            transform: translateY(-7px) scale(.985);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @media (max-width: 560px) {
          .members-department-selected-copy small,
          .members-department-option-copy small {
            display: none;
          }

          .members-department-menu {
            max-height: 330px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .members-department-trigger,
          .members-department-icon,
          .members-department-chevron,
          .members-department-option,
          .members-department-menu {
            animation: none;
            transition: none;
          }
        }
      `}</style>
    </div>
  );
}