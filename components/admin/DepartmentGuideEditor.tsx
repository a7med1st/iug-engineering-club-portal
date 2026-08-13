"use client";

import { useState } from "react";
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

export default function DepartmentGuideEditor({ departments }: { departments: GuideDepartment[] }) {
  const [selectedId, setSelectedId] = useState(departments[0]?.id ?? "");
  const selected = departments.find((department) => department.id === selectedId);

  if (!departments.length) {
    return <p className="muted">لا توجد أقسام متاحة لتحرير دليلها حاليًا.</p>;
  }

  return (
    <>
      <label className="guide-selector">
        <span>القسم</span>
        <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
          {departments.map((department) => (
            <option value={department.id} key={department.id}>{department.nameAr}</option>
          ))}
        </select>
      </label>

      {selected && (
        <form action={saveGuide} className="stack-form guide-editor-form" key={selected.id}>
          <input type="hidden" name="departmentId" value={selected.id} />
          <label>
            نبذة عن القسم
            <textarea name="overview" defaultValue={selected.guide?.overview ?? ""} />
          </label>
          <label>
            لمن يناسب التخصص
            <textarea name="fitFor" defaultValue={selected.guide?.fitFor ?? ""} />
          </label>
          <label>
            مجالات العمل والعائد المادي التقريبي
            <textarea name="careersIncome" defaultValue={selected.guide?.careersIncome ?? ""} />
          </label>
          <label>
            الدورات والمهارات المساندة
            <textarea name="skillsCourses" defaultValue={selected.guide?.skillsCourses ?? ""} />
          </label>
          <label>
            الفروقات مع تخصصات قريبة
            <textarea name="comparisons" defaultValue={selected.guide?.comparisons ?? ""} />
          </label>
          <label>
            الأسئلة الشائعة
            <textarea name="faq" defaultValue={selected.guide?.faq ?? ""} />
          </label>
          <button className="primary-btn" type="submit">حفظ دليل القسم</button>
        </form>
      )}
    </>
  );
}
