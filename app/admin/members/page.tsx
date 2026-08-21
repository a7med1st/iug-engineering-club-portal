import AdminFeedback from "@/components/admin/AdminFeedback";
import DepartmentSelect from "@/components/admin/DepartmentSelect";

import {
  MEMBER_PERMISSION_OPTIONS,
  PERMISSIONS,
  requirePermission,
} from "@/lib/permissions";

import { prisma } from "@/lib/prisma";

import {
  createMember,
  updateMemberAccess,
} from "../actions";

export const dynamic = "force-dynamic";

const formatCreatedAt = (date: Date) =>
  new Intl.DateTimeFormat("ar-PS", {
    dateStyle: "medium",
  }).format(date);

const permissionLabelMap = new Map<string, string>(
  MEMBER_PERMISSION_OPTIONS.map((item) => [item.permission, item.label]),
);

export default async function MembersAdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
}) {
  await requirePermission(PERMISSIONS.MEMBER_MANAGE);

  const feedback = await searchParams;

  const [departments, members] = await Promise.all([
    prisma.department.findMany({
      orderBy: {
        sortOrder: "asc",
      },
    }),

    prisma.user.findMany({
      where: {
        role: "MEMBER",
      },
      include: {
        department: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
  ]);

  return (
    <section className="admin-page members-admin-page">
      <div className="admin-page-head members-page-head">
        <div>
          <span className="members-page-kicker">إدارة الفريق والصلاحيات</span>
          <h1>إدارة حسابات الأعضاء</h1>
          <p className="muted">
            أنشئ حساب عضو، اربطه بقسمه، ثم حدد صلاحياته بدقة. الصلاحيات
            المرتبطة بقسم ستعمل فقط داخل قسم العضو.
          </p>
        </div>
      </div>

      <AdminFeedback error={feedback.error} success={feedback.success} />

      {/* CREATE MEMBER */}
      <div className="admin-card admin-form-card members-surface members-create-card">
        <div className="members-card-headline">
          <div>
            <span className="members-mini-label">حساب جديد</span>
            <h2>عضو جديد</h2>
          </div>
        </div>

        <form action={createMember} className="stack-form members-form">
          <div className="form-grid members-form-grid">
            <label>
              الاسم
              <input name="name" required autoComplete="name" />
            </label>

            <label>
              البريد الإلكتروني
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                dir="ltr"
              />
            </label>

            <label>
              كلمة مرور مؤقتة
              <input
                name="password"
                type="password"
                minLength={8}
                required
                autoComplete="new-password"
                dir="ltr"
              />
            </label>

            <label>
              المسمى داخل النادي
              <input
                name="position"
                placeholder="مثال: مندوب الهندسة الميكانيكية"
              />
            </label>

            <div className="members-field">
              <span className="members-field-label">القسم المسؤول عنه</span>
              <DepartmentSelect
                departments={departments.map(({ id, nameAr }) => ({ id, nameAr }))}
                defaultValue=""
              />
            </div>

            <label>
              الدور
              <input value="عضو (MEMBER)" disabled />
              <input type="hidden" name="role" value="MEMBER" />
            </label>
          </div>

          <fieldset className="members-permissions-fieldset">
            <legend>الصلاحيات</legend>

            <p className="muted members-permissions-note">
              الصلاحيات المكتوب عليها "ضمن القسم" لا تمنح العضو وصولًا إلى
              أي قسم آخر.
            </p>

            <div className="data-list members-permission-list">
              {MEMBER_PERMISSION_OPTIONS.map((item) => (
                <label
                  key={item.permission}
                  className="data-row member-permission-row"
                >
                  <span className="member-permission-title">
                    <input
                      className="member-permission-checkbox"
                      type="checkbox"
                      name="permissions"
                      value={item.permission}
                    />
                    <span>{item.label}</span>
                  </span>

                  <small className="member-scope-badge">
                    {item.scope === "DEPARTMENT" ? "ضمن القسم" : "صلاحية عامة"}
                  </small>
                </label>
              ))}
            </div>
          </fieldset>

          <button className="primary-btn members-primary-btn" type="submit">
            إنشاء حساب العضو
          </button>
        </form>
      </div>

      {/* MEMBERS */}
      <div className="admin-card members-list-card members-surface members-existing-card">
        <div className="admin-card-head members-list-head">
          <div>
            <span className="members-mini-label">الفريق الحالي</span>
            <h2>الأعضاء الموجودون</h2>
          </div>

          <span className="count-badge members-count-badge">
            <strong>{members.length}</strong>
            <span>عضو</span>
          </span>
        </div>

        {members.length ? (
          <div className="data-list members-existing-list">
            {members.map((member) => {
              const labels = member.memberPermissions
                .map((permission) => permissionLabelMap.get(permission))
                .filter((label): label is string => Boolean(label));

              return (
                <article
                  className="data-row member-account-card"
                  key={member.id}
                >
                  <div className="member-account-content">
                    <div className="member-account-top">
                      <div>
                        <strong className="member-account-name">
                          {member.name}
                        </strong>

                        <div className="data-row-meta member-account-meta">
                          <span>{member.position || "عضو"}</span>
                          <span>{member.department?.nameAr ?? "بدون قسم"}</span>
                          <span dir="ltr">{member.email}</span>
                          <span>أضيف في {formatCreatedAt(member.createdAt)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="member-permission-summary">
                      {labels.length ? (
                        labels.map((label) => (
                          <span key={label}>{label}</span>
                        ))
                      ) : (
                        <span className="is-empty">لا توجد صلاحيات إضافية</span>
                      )}
                    </div>

                    <details className="member-access-details">
                      <summary>تعديل القسم والصلاحيات</summary>

                      <form
                        action={updateMemberAccess}
                        className="stack-form member-edit-form"
                      >
                        <input
                          type="hidden"
                          name="memberId"
                          value={member.id}
                        />

                        <div className="form-grid members-form-grid">
                          <label>
                            المسمى داخل النادي
                            <input
                              name="position"
                              defaultValue={member.position ?? ""}
                            />
                          </label>

                          <div className="members-field">
                            <span className="members-field-label">
                              القسم المسؤول عنه
                            </span>
                            <DepartmentSelect
                              departments={departments.map(({ id, nameAr }) => ({
                                id,
                                nameAr,
                              }))}
                              defaultValue={member.departmentId ?? ""}
                            />
                          </div>
                        </div>

                        <fieldset className="members-permissions-fieldset member-edit-permissions">
                          <legend>صلاحيات العضو</legend>

                          <div className="data-list members-permission-list">
                            {MEMBER_PERMISSION_OPTIONS.map((item) => (
                              <label
                                key={item.permission}
                                className="data-row member-permission-row"
                              >
                                <span className="member-permission-title">
                                  <input
                                    className="member-permission-checkbox"
                                    type="checkbox"
                                    name="permissions"
                                    value={item.permission}
                                    defaultChecked={member.memberPermissions.includes(
                                      item.permission,
                                    )}
                                  />
                                  <span>{item.label}</span>
                                </span>

                                <small className="member-scope-badge">
                                  {item.scope === "DEPARTMENT"
                                    ? "ضمن القسم"
                                    : "صلاحية عامة"}
                                </small>
                              </label>
                            ))}
                          </div>
                        </fieldset>

                        <button
                          type="submit"
                          className="primary-btn members-primary-btn"
                        >
                          حفظ الصلاحيات
                        </button>
                      </form>
                    </details>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="members-empty-state">
            <strong>لا توجد حسابات أعضاء حتى الآن</strong>
            <span>أنشئ أول حساب عضو وسيظهر هنا مباشرة.</span>
          </div>
        )}
      </div>

      <style>{`
        .members-admin-page {
          --members-blue: #1688ff;
          --members-cyan: #35d4ff;
          --members-orange: #ff8b32;
          --members-navy: #0a2340;
        }

        .members-admin-page .members-page-head {
          position: relative;
          padding: 8px 2px 4px;
        }

        .members-admin-page .members-page-kicker,
        .members-admin-page .members-mini-label {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: var(--members-blue);
          font-family: "Alexandria", sans-serif;
          font-size: .66rem;
          font-weight: 700;
        }

        .members-admin-page .members-page-kicker::before,
        .members-admin-page .members-mini-label::before {
          content: "";
          width: 7px;
          height: 7px;
          border-radius: 999px;
          background: linear-gradient(135deg, var(--members-blue), var(--members-cyan));
          box-shadow: 0 0 0 5px rgba(22, 136, 255, .08);
        }

        .members-admin-page .members-page-head h1 {
          margin-top: 5px;
        }

        .members-admin-page .members-page-head p {
          max-width: 760px;
          margin-top: 7px;
        }

        .members-admin-page .members-surface {
          position: relative;
          isolation: isolate;
          overflow: hidden;
          border: 1px solid rgba(179, 204, 232, .75);
          background:
            radial-gradient(circle at 93% 2%, rgba(22, 136, 255, .14), transparent 27%),
            radial-gradient(circle at 7% 98%, rgba(53, 212, 255, .11), transparent 28%),
            linear-gradient(180deg, #ffffff 0%, #f7fbff 100%);
          box-shadow:
            0 24px 60px rgba(6, 24, 44, .085),
            inset 0 1px 0 rgba(255,255,255,.95);
        }

        .members-admin-page .members-surface::after {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -2;
          pointer-events: none;
          background-image:
            linear-gradient(rgba(22,136,255,.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(22,136,255,.03) 1px, transparent 1px);
          background-size: 28px 28px;
          mask-image: linear-gradient(to bottom, black, transparent 66%);
        }

        .members-admin-page .members-surface::before {
          content: "";
          position: absolute;
          top: -88px;
          left: -62px;
          z-index: -1;
          width: 205px;
          height: 205px;
          border: 30px solid rgba(22, 136, 255, .045);
          border-radius: 50%;
          pointer-events: none;
        }

        .members-admin-page .members-existing-card {
          margin-top: 18px;
        }

        .members-admin-page .members-card-headline,
        .members-admin-page .members-list-head {
          position: relative;
          z-index: 1;
          padding-bottom: 15px;
          border-bottom: 1px solid rgba(194, 211, 229, .72);
        }

        .members-admin-page .members-card-headline h2,
        .members-admin-page .members-list-head h2 {
          margin: 5px 0 0;
          color: #102139;
          font-size: 1.03rem;
        }

        .members-admin-page .members-form {
          position: relative;
          z-index: 1;
          margin-top: 16px;
        }

        .members-admin-page .members-form-grid label,
        .members-admin-page .member-edit-form label {
          gap: 6px;
        }

        .members-admin-page .members-field {
          min-width: 0;
          display: grid;
          align-content: start;
          gap: 6px;
        }

        .members-admin-page .members-field-label {
          color: #102139;
          font-family: "Alexandria", sans-serif;
          font-size: .73rem;
          font-weight: 700;
          line-height: 1.5;
        }

        .members-admin-page .members-form-grid input,
        .members-admin-page .members-form-grid select,
        .members-admin-page .member-edit-form input,
        .members-admin-page .member-edit-form select {
          border-color: #cbdced;
          background: rgba(255,255,255,.88);
          transition:
            transform .2s ease,
            border-color .2s ease,
            background .2s ease,
            box-shadow .2s ease;
        }

        .members-admin-page .members-form-grid input:hover:not(:disabled),
        .members-admin-page .members-form-grid select:hover,
        .members-admin-page .member-edit-form input:hover:not(:disabled),
        .members-admin-page .member-edit-form select:hover {
          border-color: #9cc8ef;
          background: #fff;
          box-shadow: 0 7px 18px rgba(22,136,255,.07);
        }

        .members-admin-page .members-form-grid input:focus,
        .members-admin-page .members-form-grid select:focus,
        .members-admin-page .member-edit-form input:focus,
        .members-admin-page .member-edit-form select:focus {
          border-color: var(--members-blue);
          background: #fff;
          box-shadow:
            0 0 0 4px rgba(22,136,255,.10),
            0 10px 22px rgba(22,136,255,.08);
          outline: none;
        }

        .members-admin-page .members-form-grid input:disabled {
          background: rgba(238,244,250,.78);
          color: #607286;
        }

        .members-admin-page .members-permissions-fieldset {
          position: relative;
          margin: 4px 0 0;
          padding: 17px;
          border: 1px solid rgba(187, 208, 229, .82);
          border-radius: 18px;
          background:
            linear-gradient(180deg, rgba(251,253,255,.92), rgba(245,250,255,.86));
          box-shadow: inset 0 1px 0 rgba(255,255,255,.95);
        }

        .members-admin-page .members-permissions-fieldset legend {
          padding-inline: 9px;
          color: #102139;
          font-family: "Alexandria", sans-serif;
          font-size: .76rem;
          font-weight: 700;
        }

        .members-admin-page .members-permissions-note {
          margin-bottom: 12px;
          font-size: .72rem;
        }

        .members-admin-page .members-permission-list {
          gap: 9px;
        }

        .members-admin-page .member-permission-row {
          position: relative;
          min-height: 60px;
          padding: 11px 13px;
          align-items: center;
          border: 1px solid rgba(199, 215, 232, .88);
          border-radius: 14px;
          background: rgba(255,255,255,.82);
          box-shadow: 0 5px 14px rgba(6,24,44,.035);
          cursor: pointer;
          transition:
            transform .22s cubic-bezier(.22, 1, .36, 1),
            border-color .22s ease,
            background .22s ease,
            box-shadow .22s ease;
        }

        .members-admin-page .member-permission-row:hover {
          transform: translateY(-2px);
          border-color: rgba(22,136,255,.34);
          background: linear-gradient(135deg, #ffffff, #f1f9ff);
          box-shadow: 0 12px 25px rgba(14,72,126,.09);
        }

        .members-admin-page .member-permission-row:has(.member-permission-checkbox:checked) {
          border-color: rgba(22,136,255,.34);
          background:
            linear-gradient(135deg, rgba(234,246,255,.96), rgba(243,252,255,.96));
          box-shadow:
            0 10px 24px rgba(22,136,255,.08),
            inset 3px 0 0 rgba(22,136,255,.72);
        }

        .members-admin-page .member-permission-title {
          min-width: 0;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          color: #16314f;
          font-family: "Alexandria", sans-serif;
          font-size: .73rem;
          font-weight: 700;
          line-height: 1.55;
        }

        .members-admin-page .member-permission-checkbox {
          appearance: none;
          -webkit-appearance: none;
          flex: 0 0 18px;
          width: 18px;
          height: 18px;
          min-width: 18px;
          min-height: 18px;
          max-width: 18px;
          max-height: 18px;
          aspect-ratio: 1 / 1;
          margin: 0;
          padding: 0;
          display: grid;
          place-items: center;
          border: 1.5px solid #9fb7cf;
          border-radius: 4px;
          background: #fff;
          cursor: pointer;
          box-shadow: none;
          transition:
            transform .16s ease,
            border-color .16s ease,
            background .16s ease,
            box-shadow .16s ease;
        }

        .members-admin-page .member-permission-checkbox::before {
          content: "";
          width: 4px;
          height: 8px;
          margin-top: -2px;
          border-right: 2px solid #fff;
          border-bottom: 2px solid #fff;
          transform: rotate(45deg) scale(0);
          transform-origin: center;
          opacity: 0;
          transition:
            transform .14s cubic-bezier(.2,.9,.25,1.2),
            opacity .12s ease;
        }

        .members-admin-page .member-permission-checkbox:hover {
          transform: scale(1.06);
          border-color: #1688ff;
          background: #f3f9ff;
          box-shadow: 0 0 0 2px rgba(22,136,255,.07);
        }

        .members-admin-page .member-permission-checkbox:checked {
          border-color: #1688ff;
          background: linear-gradient(135deg, #1688ff 0%, #35bdf4 100%);
          box-shadow: 0 3px 8px rgba(22,136,255,.18);
        }

        .members-admin-page .member-permission-checkbox:checked::before {
          transform: rotate(45deg) scale(1);
          opacity: 1;
        }

        .members-admin-page .member-permission-checkbox:active {
          transform: scale(.92);
        }

        .members-admin-page .member-permission-checkbox:focus-visible {
          outline: 3px solid rgba(22,136,255,.20);
          outline-offset: 3px;
        }

        .members-admin-page .member-scope-badge {
          flex: 0 0 auto;
          width: fit-content;
          max-width: max-content;
          align-self: center;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          white-space: nowrap;
          padding: 3px 7px;
          border: 1px solid #d7e4f0;
          border-radius: 999px;
          background: rgba(245, 249, 253, .9);
          color: #718399;
          font-family: "Alexandria", sans-serif;
          font-size: .56rem;
          font-weight: 600;
          line-height: 1.25;
          transition:
            transform .2s ease,
            border-color .2s ease,
            background .2s ease,
            color .2s ease,
            box-shadow .2s ease;
        }

        .members-admin-page .member-permission-row:hover .member-scope-badge {
          transform: translateY(-1px);
          border-color: #b7d7f2;
          background: #edf7ff;
          color: #2378c3;
          box-shadow: 0 5px 12px rgba(22,136,255,.08);
        }

        .members-admin-page .members-primary-btn {
          position: relative;
          overflow: hidden;
          width: 100%;
          border: 0;
          background: linear-gradient(105deg, #0b65cf 0%, #1688ff 47%, #35d4ff 100%);
          box-shadow:
            0 14px 30px rgba(22,136,255,.22),
            inset 0 1px 0 rgba(255,255,255,.26);
          transition:
            transform .24s cubic-bezier(.22,1,.36,1),
            box-shadow .24s ease,
            filter .24s ease;
        }

        .members-admin-page .members-primary-btn::after {
          content: "";
          position: absolute;
          inset: -70% auto -70% -30%;
          width: 26%;
          transform: rotate(18deg) translateX(-180%);
          background: rgba(255,255,255,.33);
          filter: blur(2px);
          transition: transform .5s ease;
        }

        .members-admin-page .members-primary-btn:hover {
          transform: translateY(-3px);
          filter: saturate(1.07);
          background: linear-gradient(105deg, #0b65cf 0%, #1688ff 43%, #35d4ff 76%, #ff8b32 122%);
          box-shadow:
            0 20px 38px rgba(22,136,255,.28),
            0 8px 22px rgba(255,139,50,.08);
        }

        .members-admin-page .members-primary-btn:hover::after {
          transform: rotate(18deg) translateX(560%);
        }

        .members-admin-page .members-primary-btn:active {
          transform: translateY(0) scale(.992);
        }

        .members-admin-page .members-list-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
        }

        .members-admin-page .members-count-badge {
          min-width: 64px;
          padding: 8px 11px;
          display: inline-flex;
          align-items: baseline;
          justify-content: center;
          gap: 5px;
          border: 1px solid rgba(22,136,255,.16);
          border-radius: 14px;
          background: rgba(255,255,255,.78);
          color: #6a7b8f;
          box-shadow: 0 9px 22px rgba(9,45,82,.06);
        }

        .members-admin-page .members-count-badge strong {
          color: var(--members-blue);
          font-family: "Manrope", sans-serif;
          font-size: 1rem;
        }

        .members-admin-page .members-count-badge span {
          font-size: .63rem;
        }

        .members-admin-page .members-existing-list {
          position: relative;
          z-index: 1;
          gap: 12px;
          margin-top: 16px;
        }

        .members-admin-page .member-account-card {
          position: relative;
          overflow: hidden;
          padding: 16px;
          border: 1px solid rgba(197,214,232,.88);
          border-inline-start: 4px solid var(--members-blue);
          border-radius: 17px;
          background: rgba(255,255,255,.84);
          box-shadow: 0 8px 22px rgba(6,24,44,.045);
          transition:
            transform .24s cubic-bezier(.22,1,.36,1),
            border-color .24s ease,
            box-shadow .24s ease,
            background .24s ease;
        }

        .members-admin-page .member-account-card:hover {
          transform: translateY(-3px);
          border-color: rgba(22,136,255,.34);
          background: #fff;
          box-shadow: 0 16px 34px rgba(8,51,92,.105);
        }

        .members-admin-page .member-account-content {
          width: 100%;
          min-width: 0;
        }

        .members-admin-page .member-account-name {
          display: block;
          color: #102139;
          font-family: "Alexandria", sans-serif;
          font-size: .84rem;
        }

        .members-admin-page .member-account-meta {
          margin-top: 7px;
          gap: 6px 9px;
        }

        .members-admin-page .member-account-meta span {
          padding: 4px 8px;
          border: 1px solid #dbe6f0;
          border-radius: 999px;
          background: #f7fbff;
        }

        .members-admin-page .member-permission-summary {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 10px;
        }

        .members-admin-page .member-permission-summary span {
          padding: 5px 9px;
          border: 1px solid #cee1f2;
          border-radius: 999px;
          background: linear-gradient(180deg, #f7fbff, #eef7ff);
          color: #3f668d;
          font-size: .64rem;
        }

        .members-admin-page .member-permission-summary .is-empty {
          color: #7b8a9b;
          background: #f6f8fb;
        }

        .members-admin-page .member-access-details {
          margin-top: 13px;
          border-top: 1px solid #e0e8f1;
          padding-top: 11px;
        }

        .members-admin-page .member-access-details summary {
          width: fit-content;
          padding: 7px 10px;
          border-radius: 10px;
          color: #2b557d;
          cursor: pointer;
          font-family: "Alexandria", sans-serif;
          font-size: .68rem;
          font-weight: 700;
          transition: background .2s ease, color .2s ease, transform .2s ease;
        }

        .members-admin-page .member-access-details summary:hover {
          transform: translateY(-1px);
          background: #edf7ff;
          color: var(--members-blue);
        }

        .members-admin-page .member-access-details[open] summary {
          background: linear-gradient(135deg, #edf7ff, #f1fcff);
          color: var(--members-blue);
        }

        .members-admin-page .member-edit-form {
          margin-top: 16px;
          padding: 15px;
          border: 1px solid #d8e5f1;
          border-radius: 15px;
          background: rgba(248,252,255,.78);
          animation: memberEditOpen .22s cubic-bezier(.22,1,.36,1) both;
        }

        .members-admin-page .member-edit-permissions {
          margin-top: 2px;
        }

        .members-admin-page .members-empty-state {
          min-height: 180px;
          margin-top: 15px;
          padding: 28px 20px;
          display: grid;
          place-items: center;
          align-content: center;
          gap: 5px;
          border: 1px dashed #bfd7ed;
          border-radius: 16px;
          background: rgba(255,255,255,.62);
          text-align: center;
        }

        .members-admin-page .members-empty-state strong {
          color: #18324f;
          font-family: "Alexandria", sans-serif;
          font-size: .82rem;
        }

        .members-admin-page .members-empty-state span {
          color: #77889b;
          font-size: .7rem;
        }

        @keyframes memberEditOpen {
          from {
            opacity: 0;
            transform: translateY(-6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 760px) {
          .members-admin-page .member-permission-row {
            align-items: flex-start;
            flex-direction: column;
          }

          .members-admin-page .member-scope-badge {
            margin-inline-start: 30px;
            align-self: flex-start;
          }

          .members-admin-page .members-list-head {
            align-items: flex-start;
          }
        }

        @media (max-width: 560px) {
          .members-admin-page .members-surface {
            padding: 16px;
          }

          .members-admin-page .member-permission-title {
            align-items: flex-start;
          }

          .members-admin-page .member-account-card {
            padding: 14px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .members-admin-page .member-permission-row,
          .members-admin-page .member-permission-checkbox,
          .members-admin-page .members-primary-btn,
          .members-admin-page .member-account-card,
          .members-admin-page .member-access-details summary,
          .members-admin-page .member-edit-form {
            animation: none;
            transition: none;
          }

          .members-admin-page .member-permission-row:hover,
          .members-admin-page .members-primary-btn:hover,
          .members-admin-page .member-account-card:hover,
          .members-admin-page .member-access-details summary:hover {
            transform: none;
          }
        }
      `}</style>
    </section>
  );
}