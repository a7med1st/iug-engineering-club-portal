"use client";

import { useMemo, useState } from "react";

type DepartmentOption = {
  id: string;
  nameAr: string;
};

export default function DepartmentChecklist({ departments }: { departments: DepartmentOption[] }) {
  const allIds = useMemo(() => departments.map((department) => department.id), [departments]);
  const [selectedIds, setSelectedIds] = useState<string[]>(allIds);
  const allSelected = departments.length > 0 && selectedIds.length === departments.length;

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? allIds : []);
  }

  function toggleDepartment(id: string, checked: boolean) {
    setSelectedIds((current) => (
      checked ? [...current, id] : current.filter((departmentId) => departmentId !== id)
    ));
  }

  return (
    <fieldset className="department-checklist">
      <legend>الأقسام المستهدفة</legend>
      <label className="department-checklist-head">
        <input
          type="checkbox"
          name="departmentIds"
          value="all"
          required={!selectedIds.length}
          checked={allSelected}
          onChange={(event) => toggleAll(event.target.checked)}
        />
        <span>
          <strong>جميع الأقسام</strong>
          <small>سيظهر النشاط للطلاب باعتباره نشاطًا عامًا.</small>
        </span>
      </label>
      <div className="department-options">
        {departments.map((department) => (
          <label className="department-option" key={department.id}>
            <input
              type="checkbox"
              name="departmentIds"
              value={department.id}
              checked={selectedIds.includes(department.id)}
              onChange={(event) => toggleDepartment(department.id, event.target.checked)}
            />
            <span>{department.nameAr}</span>
          </label>
        ))}
      </div>
      {!selectedIds.length && (
        <p className="form-error" role="alert">اختر قسمًا واحدًا على الأقل أو اختر جميع الأقسام.</p>
      )}
    </fieldset>
  );
}
