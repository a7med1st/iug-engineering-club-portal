"use client";

import {
  Building2,
  Check,
  ChevronDown,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useCspNonce,
} from "@/components/security/CspNonce";

type DepartmentOption = {
  id: string;
  nameAr: string;
};

type Props = {
  name?: string;
  departments: DepartmentOption[];
  defaultValues?: string[];
  defaultValue?: string;
  placeholder?: string;
};

export default function DepartmentMultiSelect({
  name = "managedDepartmentIds",
  departments,
  defaultValues,
  defaultValue = "",
  placeholder = "بدون أقسام محددة",
}: Props) {
  const nonce = useCspNonce();
  const rootRef =
    useRef<HTMLDivElement>(null);

  const allowedIds = useMemo(
    () =>
      new Set(
        departments.map(
          (department) =>
            department.id,
        ),
      ),
    [departments],
  );

  const initialValues = useMemo(
    () => {
      const source =
        defaultValues ??
        (defaultValue
          ? [defaultValue]
          : []);

      return [
        ...new Set(
          source.filter((id) =>
            allowedIds.has(id),
          ),
        ),
      ];
    },
    [
      allowedIds,
      defaultValue,
      defaultValues,
    ],
  );

  const [values, setValues] =
    useState<string[]>(
      initialValues,
    );

  const [open, setOpen] =
    useState(false);

  useEffect(() => {
    setValues(initialValues);
  }, [initialValues]);

  useEffect(() => {
    function handleOutside(
      event: PointerEvent,
    ) {
      if (
        !rootRef.current?.contains(
          event.target as Node,
        )
      ) {
        setOpen(false);
      }
    }

    function handleEscape(
      event: KeyboardEvent,
    ) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener(
      "pointerdown",
      handleOutside,
    );

    document.addEventListener(
      "keydown",
      handleEscape,
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        handleOutside,
      );

      document.removeEventListener(
        "keydown",
        handleEscape,
      );
    };
  }, []);

  const selectedDepartments =
    departments.filter(
      (department) =>
        values.includes(
          department.id,
        ),
    );

  function toggle(id: string) {
    setValues((current) =>
      current.includes(id)
        ? current.filter(
            (value) =>
              value !== id,
          )
        : [...current, id],
    );
  }

  return (
    <div
      ref={rootRef}
      className={`members-department-select members-department-multi-select ${open ? "is-open" : ""}`}
    >
      {values.map((id) => (
        <input
          key={id}
          type="hidden"
          name={name}
          value={id}
        />
      ))}

      <button
        type="button"
        className="members-department-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() =>
          setOpen(
            (current) =>
              !current,
          )
        }
      >
        <span className="members-department-selected">
          <span
            className="members-department-icon"
            aria-hidden="true"
          >
            <Building2
              size={18}
            />
          </span>

          <span className="members-department-selected-copy">
            <strong>
              {values.length
                ? `${values.length} قسم/أقسام محددة`
                : placeholder}
            </strong>

            <small>
              {values.length
                ? selectedDepartments
                    .map(
                      (department) =>
                        department.nameAr,
                    )
                    .join("، ")
                : "يمكنك اختيار أكثر من قسم للمندوب"}
            </small>
          </span>
        </span>

        <span
          className="members-department-chevron"
          aria-hidden="true"
        >
          <ChevronDown
            size={20}
          />
        </span>
      </button>

      {selectedDepartments.length >
        0 && (
        <div className="members-department-multi-chips">
          {selectedDepartments.map(
            (department) => (
              <button
                key={
                  department.id
                }
                type="button"
                className="members-department-chip"
                onClick={() =>
                  toggle(
                    department.id,
                  )
                }
                title={`إزالة ${department.nameAr}`}
              >
                <span>
                  {
                    department.nameAr
                  }
                </span>

                <X
                  size={13}
                  aria-hidden="true"
                />
              </button>
            ),
          )}
        </div>
      )}

      {open && (
        <div
          className="members-department-menu"
          role="listbox"
          aria-multiselectable="true"
          aria-label="اختيار الأقسام المسؤول عنها"
        >
          <div className="members-department-menu-head">
            <span>
              اختر الأقسام المسؤول عنها
            </span>

            <small>
              {values.length} محدد
            </small>
          </div>

          <div className="members-department-options">
            {departments.map(
              (department) => {
                const active =
                  values.includes(
                    department.id,
                  );

                return (
                  <button
                    key={
                      department.id
                    }
                    type="button"
                    role="option"
                    aria-selected={
                      active
                    }
                    className={`members-department-option ${active ? "is-active" : ""}`}
                    onClick={() =>
                      toggle(
                        department.id,
                      )
                    }
                  >
                    <span className="members-department-option-icon">
                      <Building2
                        size={17}
                      />
                    </span>

                    <span className="members-department-option-copy">
                      <strong>
                        {
                          department.nameAr
                        }
                      </strong>

                      <small>
                        {active
                          ? "هذا القسم ضمن مسؤوليات العضو"
                          : "اضغط لإضافة القسم إلى مسؤوليات العضو"}
                      </small>
                    </span>

                    <span
                      className="members-department-check"
                      aria-hidden="true"
                    >
                      {active ? (
                        <Check
                          size={16}
                        />
                      ) : null}
                    </span>
                  </button>
                );
              },
            )}
          </div>
        </div>
      )}

      <style
        nonce={nonce}
        suppressHydrationWarning
      >{`
        .members-department-select {
          position: relative;
          width: 100%;
          direction: rtl;
          font-family: "Alexandria", sans-serif;
        }

        .members-department-trigger {
          width: 100%;
          min-height: 54px;
          padding: 7px 10px 7px 11px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border: 1px solid #c8dced;
          border-radius: 14px;
          background: linear-gradient(180deg, rgba(255,255,255,.98), rgba(247,251,255,.96));
          color: #102139;
          cursor: pointer;
          text-align: right;
          box-shadow:
            0 6px 18px rgba(8,46,84,.045),
            inset 0 1px 0 rgba(255,255,255,.95);
        }

        .members-department-trigger:hover,
        .members-department-select.is-open .members-department-trigger {
          border-color: #8cc2f2;
          box-shadow:
            0 0 0 4px rgba(22,136,255,.08),
            0 12px 28px rgba(10,74,132,.10);
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
          font-size: .69rem;
          line-height: 1.35;
          overflow-wrap: anywhere;
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
          transition: transform .2s ease;
        }

        .members-department-select.is-open .members-department-chevron {
          transform: rotate(180deg);
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
            linear-gradient(180deg, rgba(255,255,255,.995), rgba(247,251,255,.99));
          box-shadow:
            0 26px 60px rgba(5,31,61,.22),
            0 7px 20px rgba(22,136,255,.09);
          backdrop-filter: blur(18px);
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
        }

        .members-department-option:hover {
          border-color: rgba(22,136,255,.15);
          background: linear-gradient(90deg, #eef8ff, #f8fcff);
        }

        .members-department-option.is-active {
          border-color: rgba(22,136,255,.24);
          background: linear-gradient(135deg, rgba(22,136,255,.12), rgba(53,212,255,.08));
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
          font-size: .66rem;
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
        }

        html[data-theme="dark"] .members-department-trigger {
          border-color: rgba(91,169,224,.30);
          background: #0a2941;
          color: #e7f2fb;
          box-shadow: none;
        }

        html[data-theme="dark"] .members-department-selected-copy strong,
        html[data-theme="dark"] .members-department-option-copy strong,
        html[data-theme="dark"] .members-department-menu-head span {
          color: #e7f2fb;
        }

        html[data-theme="dark"] .members-department-selected-copy small,
        html[data-theme="dark"] .members-department-option-copy small {
          color: #9fb9ce;
        }

        html[data-theme="dark"] .members-department-icon,
        html[data-theme="dark"] .members-department-chevron {
          border-color: rgba(91,169,224,.24);
          background: #103550;
          color: #67c7ff;
        }

        html[data-theme="dark"] .members-department-menu {
          border-color: rgba(91,169,224,.34);
          background:
            radial-gradient(circle at 92% 0%, rgba(22,136,255,.12), transparent 35%),
            linear-gradient(180deg, #0b2941, #071f33);
          box-shadow: 0 26px 60px rgba(0,7,18,.45);
        }

        html[data-theme="dark"] .members-department-menu-head {
          border-bottom-color: rgba(91,169,224,.20);
        }

        html[data-theme="dark"] .members-department-menu-head small {
          background: rgba(22,136,255,.14);
          color: #8ed2ff;
        }

        html[data-theme="dark"] .members-department-option {
          color: #dcecf8;
        }

        html[data-theme="dark"] .members-department-option:hover,
        html[data-theme="dark"] .members-department-option.is-active {
          border-color: rgba(103,199,255,.24);
          background: #10334d;
        }

        html[data-theme="dark"] .members-department-option-icon {
          border-color: rgba(91,169,224,.22);
          background: #0a2941;
          color: #8fb4d0;
        }

        .members-department-multi-select {
          position: relative;
          width: 100%;
          direction: rtl;
          font-family: "Alexandria", sans-serif;
        }

        .members-department-multi-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 8px;
        }

        .members-department-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-height: 30px;
          padding: 5px 9px;
          border: 1px solid rgba(22, 136, 255, .2);
          border-radius: 999px;
          background: rgba(22, 136, 255, .08);
          color: #147bdc;
          cursor: pointer;
          font-family: "Alexandria", sans-serif;
          font-size: .66rem;
          font-weight: 700;
        }

        .members-department-chip:hover {
          border-color: rgba(22, 136, 255, .38);
          background: rgba(22, 136, 255, .13);
        }

        html[data-theme="dark"] .members-department-chip {
          border-color: rgba(91, 169, 224, .35);
          background: rgba(22, 136, 255, .13);
          color: #8ed2ff;
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
      `}</style>
    </div>
  );
}
