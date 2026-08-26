"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Save } from "lucide-react";

import { saveGuide } from "@/app/admin/actions";

type Guide = {
  overview: string;
  fitFor: string;
  careersIncome: string;
  skillsCourses: string;
  comparisons: string;
  faq: string;
} | null;

type GuideDepartment = {
  id: string;
  nameAr: string;
  guide: Guide;
};

const fields = [
  {
    name: "overview",
    label: "نبذة عن القسم",
    hint: "اكتب تعريفًا مختصرًا وواضحًا عن القسم وطبيعة الدراسة فيه.",
  },
  {
    name: "fitFor",
    label: "لمن يناسب التخصص",
    hint: "اذكر الميول والقدرات التي تجعل الطالب مناسبًا لهذا التخصص.",
  },
  {
    name: "careersIncome",
    label: "مجالات العمل والعائد المادي التقريبي",
    hint: "أبرز المسارات الوظيفية وفرص العمل والمجالات المهنية.",
  },
  {
    name: "skillsCourses",
    label: "الدورات والمهارات المساندة",
    hint: "المهارات والدورات التي تنفع الطالب أثناء الدراسة وبعدها.",
  },
  {
    name: "comparisons",
    label: "الفروقات مع تخصصات قريبة",
    hint: "وضّح الفروقات الأساسية حتى يسهل على الطالب المقارنة.",
  },
  {
    name: "faq",
    label: "الأسئلة الشائعة",
    hint: "أضف أكثر الأسئلة التي يسألها الطلاب مع إجابات مختصرة.",
  },
] as const;

export default function DepartmentGuideEditor({
  departments,
}: {
  departments: GuideDepartment[];
}) {
  const [selectedId, setSelectedId] = useState(departments[0]?.id ?? "");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const selected = departments.find(
    (department) => department.id === selectedId,
  );

  useEffect(() => {
    function closeMenu(event: PointerEvent) {
      const target = event.target as Node | null;
      if (target && !menuRef.current?.contains(target)) {
        setMenuOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("pointerdown", closeMenu);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeMenu);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  if (!departments.length) {
    return <p className="muted">لا توجد أقسام متاحة لتحرير دليلها حاليًا.</p>;
  }

  return (
    <div className="guide-redesign">
      <div className="guide-toolbar">
        <div className="guide-toolbar-copy">
          <strong>حدد القسم الذي تريد تحديث دليله</strong>
        </div>

        <div className="guide-department-select" ref={menuRef}>
          <button
            type="button"
            className={`guide-department-trigger ${menuOpen ? "is-open" : ""}`}
            aria-haspopup="listbox"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((current) => !current)}
          >
            <span>{selected?.nameAr ?? "اختر قسمًا"}</span>
            <span className="guide-department-chevron" aria-hidden="true">
              <ChevronDown size={18} />
            </span>
          </button>

          {menuOpen && (
            <div
              className="guide-department-menu"
              role="listbox"
              aria-label="القسم"
            >
              {departments.map((department) => {
                const active = department.id === selectedId;

                return (
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`guide-department-option ${
                      active ? "is-active" : ""
                    }`}
                    key={department.id}
                    onClick={() => {
                      setSelectedId(department.id);
                      setMenuOpen(false);
                    }}
                  >
                    <span className="guide-department-option-check">
                      {active ? <Check size={14} /> : null}
                    </span>
                    <span>{department.nameAr}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {selected && (
        <form
          action={saveGuide}
          className="guide-editor-form guide-editor-form-redesign"
          key={selected.id}
        >
          <input type="hidden" name="departmentId" value={selected.id} />

          <div className="guide-fields-grid">
            {fields.map((field, index) => (
              <label className="guide-field-card" key={field.name}>
                <span className="guide-field-head">
                  <span className="guide-field-number">{index + 1}</span>
                  <span className="guide-field-copy">
                    <strong>{field.label}</strong>
                    <small>{field.hint}</small>
                  </span>
                </span>

                <textarea
                  name={field.name}
                  rows={5}
                  defaultValue={selected.guide?.[field.name] ?? ""}
                  placeholder="ابدأ الكتابة هنا..."
                />
              </label>
            ))}
          </div>

          <div className="guide-save-row">
            <div>
              <strong>جاهز للحفظ؟</strong>
              <span>سيتم تحديث دليل القسم المحدد فقط.</span>
            </div>

            <button className="primary-btn guide-save-btn" type="submit">
              <Save size={17} />
              حفظ دليل القسم
            </button>
          </div>
        </form>
      )}

      <style>{`
        .guide-redesign {
          position: relative;
          isolation: isolate;
          min-width: 0;
        }

        .guide-toolbar {
          position: relative;
          z-index: 25;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 22px;
          padding: 16px 18px;
          border: 1px solid rgba(185, 209, 234, .82);
          border-radius: 18px;
          background:
            radial-gradient(circle at 92% 12%, rgba(22,136,255,.10), transparent 32%),
            linear-gradient(135deg, rgba(255,255,255,.94), rgba(244,250,255,.93));
          box-shadow: 0 12px 30px rgba(8, 43, 78, .065);
        }

        .guide-toolbar-copy {
          min-width: 0;
          display: grid;
          gap: 4px;
        }

        .guide-toolbar-kicker {
          color: #1688ff;
          font-family: "Alexandria", sans-serif;
          font-size: .64rem;
          font-weight: 700;
        }

        .guide-toolbar-copy strong {
          color: var(--theme-strong-text);
          font-family: "Alexandria", sans-serif;
          font-size: .82rem;
        }

        .guide-department-select {
          position: relative;
          width: min(390px, 46%);
          flex: 0 0 auto;
        }

        .guide-department-trigger {
          width: 100%;
          min-height: 48px;
          padding: 8px 10px 8px 13px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          border: 1px solid #c9dced;
          border-radius: 14px;
          background: rgba(255,255,255,.94);
          color: #142b46;
          cursor: pointer;
          text-align: right;
          font-family: "Alexandria", sans-serif;
          font-size: .78rem;
          font-weight: 700;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.95);
          transition: border-color .22s ease, box-shadow .22s ease, transform .22s ease, background .22s ease;
        }

        .guide-department-trigger:hover {
          transform: translateY(-1px);
          border-color: #8fc4f3;
          background: linear-gradient(135deg, #fff, #f0f8ff);
          box-shadow: 0 9px 22px rgba(22,136,255,.11);
        }

        .guide-department-trigger.is-open {
          border-color: #1688ff;
          box-shadow: 0 0 0 3px rgba(22,136,255,.10), 0 12px 26px rgba(22,136,255,.10);
        }

        .guide-department-chevron {
          flex: 0 0 auto;
          width: 32px;
          height: 32px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          background: #edf6ff;
          color: #1688ff;
          transition: transform .22s ease, background .22s ease, color .22s ease;
        }

        .guide-department-trigger.is-open .guide-department-chevron {
          transform: rotate(180deg);
          background: linear-gradient(135deg, #1688ff, #35d4ff);
          color: #fff;
        }

        .guide-department-menu {
          position: absolute;
          inset-inline: 0;
          top: calc(100% + 8px);
          z-index: 40;
          max-height: 310px;
          padding: 7px;
          overflow-y: auto;
          border: 1px solid rgba(173, 204, 234, .88);
          border-radius: 16px;
          background: rgba(255,255,255,.98);
          box-shadow: 0 22px 48px rgba(6, 31, 60, .18);
          backdrop-filter: blur(16px);
          animation: guideMenuIn .18s cubic-bezier(.22,1,.36,1) both;
        }

        .guide-department-option {
          width: 100%;
          min-height: 44px;
          padding: 8px 10px;
          display: flex;
          align-items: center;
          gap: 10px;
          border: 1px solid transparent;
          border-radius: 11px;
          background: transparent;
          color: #29435f;
          cursor: pointer;
          text-align: right;
          font-family: "Alexandria", sans-serif;
          font-size: .72rem;
          transition: transform .18s ease, background .18s ease, border-color .18s ease;
        }

        .guide-department-option:hover {
          transform: translateX(-2px);
          border-color: rgba(22,136,255,.12);
          background: #f2f9ff;
        }

        .guide-department-option.is-active {
          border-color: rgba(22,136,255,.18);
          background: linear-gradient(135deg, rgba(22,136,255,.10), rgba(53,212,255,.08));
          color: #0b70d0;
        }

        .guide-department-option-check {
          flex: 0 0 auto;
          width: 27px;
          height: 27px;
          display: grid;
          place-items: center;
          border: 1px solid #d8e5f1;
          border-radius: 8px;
          background: #fff;
          color: #1688ff;
        }

        .guide-department-option.is-active .guide-department-option-check {
          border-color: transparent;
          background: linear-gradient(135deg, #1688ff, #35d4ff);
          color: #fff;
        }

        .guide-editor-form-redesign {
          display: block;
        }

        .guide-fields-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 15px;
        }

        .guide-field-card {
          position: relative;
          min-width: 0;
          padding: 15px;
          display: grid;
          gap: 12px;
          border: 1px solid rgba(198, 216, 234, .9);
          border-radius: 17px;
          background:
            radial-gradient(circle at 95% 0%, rgba(22,136,255,.06), transparent 32%),
            linear-gradient(180deg, rgba(255,255,255,.97), rgba(248,251,255,.94));
          box-shadow: 0 8px 24px rgba(6, 31, 61, .045);
          transition: transform .24s ease, border-color .24s ease, box-shadow .24s ease, background .24s ease;
        }

        .guide-field-card:hover {
          transform: translateY(-3px);
          border-color: rgba(22,136,255,.28);
          background: linear-gradient(180deg, #fff, #f5fbff);
          box-shadow: 0 15px 32px rgba(8, 51, 94, .09);
        }

        .guide-field-head {
          display: flex;
          align-items: flex-start;
          gap: 10px;
        }

        .guide-field-number {
          flex: 0 0 auto;
          width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          border-radius: 9px;
          background: linear-gradient(135deg, #e8f4ff, #edfaff);
          color: #1688ff;
          font-family: "Manrope", sans-serif;
          font-size: .72rem;
          font-weight: 800;
        }

        .guide-field-copy {
          min-width: 0;
          display: grid;
          gap: 3px;
        }

        .guide-field-copy strong {
          color: #102139;
          font-family: "Alexandria", sans-serif;
          font-size: .78rem;
        }

        .guide-field-copy small {
          color: #7a8b9f;
          font-size: .64rem;
          line-height: 1.65;
        }

        .guide-field-card textarea {
          width: 100%;
          min-height: 145px;
          resize: vertical;
          padding: 13px 14px;
          border: 1px solid #cadbec;
          border-radius: 13px;
          outline: none;
          background: rgba(255,255,255,.91);
          color: #18314d;
          line-height: 1.85;
          transition: border-color .22s ease, box-shadow .22s ease, background .22s ease;
        }

        .guide-field-card textarea:hover {
          border-color: #a9cceb;
          background: #fff;
        }

        .guide-field-card textarea:focus {
          border-color: #1688ff;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(22,136,255,.10), 0 10px 24px rgba(22,136,255,.07);
        }

        .guide-field-card textarea::placeholder {
          color: #9aa8b8;
        }

        .guide-save-row {
          margin-top: 18px;
          padding: 15px 17px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          border: 1px solid rgba(180, 207, 233, .75);
          border-radius: 17px;
          background:
            radial-gradient(circle at 88% 20%, rgba(53,212,255,.09), transparent 32%),
            linear-gradient(135deg, #f8fcff, #eef8ff);
        }

        .guide-save-row > div {
          display: grid;
          gap: 3px;
        }

        .guide-save-row > div strong {
          color: #18314d;
          font-family: "Alexandria", sans-serif;
          font-size: .76rem;
        }

        .guide-save-row > div span {
          color: #74879b;
          font-size: .66rem;
        }

        .guide-save-btn {
          min-width: 190px;
          background: linear-gradient(115deg, #0d6fe6 0%, #1688ff 48%, #35d4ff 100%);
          box-shadow: 0 12px 28px rgba(22,136,255,.22);
        }

        .guide-save-btn:hover {
          transform: translateY(-2px);
          background: linear-gradient(115deg, #0b64cf 0%, #1688ff 40%, #35d4ff 76%, #ff9a45 120%);
          box-shadow: 0 17px 34px rgba(22,136,255,.28);
        }

        @keyframes guideMenuIn {
          from { opacity: 0; transform: translateY(-6px) scale(.99); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @media (max-width: 820px) {
          .guide-toolbar {
            align-items: stretch;
            flex-direction: column;
          }

          .guide-department-select {
            width: 100%;
          }

          .guide-fields-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 560px) {
          .guide-toolbar,
          .guide-field-card,
          .guide-save-row {
            padding: 13px;
          }

          .guide-save-row {
            align-items: stretch;
            flex-direction: column;
          }

          .guide-save-btn {
            width: 100%;
            min-width: 0;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .guide-field-card,
          .guide-department-trigger,
          .guide-department-option,
          .guide-save-btn,
          .guide-department-menu {
            transition: none;
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
