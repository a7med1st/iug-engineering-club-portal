import Link from "next/link";

import ActivityFormBuilder from "@/components/admin/ActivityFormBuilder";
import AdminFeedback from "@/components/admin/AdminFeedback";
import DeleteActivityForm from "@/components/admin/DeleteActivityForm";
import DepartmentChecklist from "@/components/admin/DepartmentChecklist";
import ActivitySchedulePicker from "@/components/admin/ActivitySchedulePicker";
import { NonceStyle } from "@/components/security/CspNonce";

import {
  ACTIVITY_ADMIN_PERMISSIONS,
  PERMISSIONS,
  canAccessActivityDepartments,
  hasPermission,
  requireAnyPermission,
} from "@/lib/permissions";

import { prisma } from "@/lib/prisma";
import { formatActivitySchedule } from "@/lib/activities";

import { createActivity } from "../actions";

export const dynamic = "force-dynamic";

const statusLabels = {
  DRAFT: "مسودة",
  PUBLISHED: "منشور",
  ARCHIVED: "مؤرشف",
} as const;

export default async function ActivitiesAdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
}) {
  const { user } = await requireAnyPermission(ACTIVITY_ADMIN_PERMISSIONS);

  const feedback = await searchParams;

  const isAdmin = user.role === "ADMIN";

  const canManageActivities = hasPermission(
    user.role,
    PERMISSIONS.ACTIVITY_MANAGE,
    user.memberPermissions,
  );

  const canReviewRegistrations = hasPermission(
    user.role,
    PERMISSIONS.REGISTRATION_REVIEW,
    user.memberPermissions,
  );

  const departments = isAdmin
    ? await prisma.department.findMany({
      orderBy: {
        sortOrder: "asc",
      },
    })
    : user.departmentId
      ? await prisma.department.findMany({
        where: {
          id: user.departmentId,
        },
        orderBy: {
          sortOrder: "asc",
        },
      })
      : [];

  const rawActivities = await prisma.activity.findMany({
    where:
      isAdmin || !user.departmentId
        ? undefined
        : {
          departments: {
            some: {
              departmentId: user.departmentId,
            },
          },
        },

    include: {
      departments: {
        include: {
          department: true,
        },
      },

      registrationForm: {
        include: {
          _count: {
            select: {
              questions: true,
              submissions: true,
            },
          },
        },
      },
    },

    orderBy: {
      startsAt: "desc",
    },
  });

  const activities = rawActivities.filter((activity) =>
    canAccessActivityDepartments(
      user,
      activity.departments.map((link) => link.departmentId),
    ),
  );

  return (
    <section className="admin-page activities-admin-page">
      <div className="admin-page-head">
        <div>
          <h1>{isAdmin ? "إدارة الأنشطة" : "أنشطة القسم"}</h1>

          <p className="muted">
            {isAdmin
              ? "أنشئ الأنشطة وحدد الأقسام المستهدفة، ثم تابع التسجيلات."
              : `يمكنك إدارة الأنشطة المرتبطة حصريًا بقسم ${user.department?.nameAr ?? "المحدد لحسابك"
              } فقط.`}
          </p>
        </div>
      </div>

      <AdminFeedback error={feedback.error} success={feedback.success} />

      <div className="admin-content-grid">
        {canManageActivities && (
          <div className="admin-card activity-form-panel">
            <h2>بيانات النشاط</h2>

            <form action={createActivity} className="stack-form">
              <label>
                اسم النشاط

                <input
                  name="title"
                  required
                  placeholder="مثال: ورشة تطوير تطبيقات الويب"
                />
              </label>

              <label>
                وصف مختصر للنشاط

                <textarea
                  name="description"
                  required
                  rows={5}
                  placeholder="اكتب وصفًا مختصرًا وواضحًا للنشاط"
                />
              </label>

              <ActivitySchedulePicker />

              <div className="form-grid">

                <label>
                  مكان النشاط

                  <input
                    name="location"
                    required
                    placeholder="مثال: مبنى طيبة - القاعة 201"
                  />
                </label>

                <label>
                  السعة الطلابية

                  <input
                    type="number"
                    min="1"
                    name="capacity"
                    required
                    placeholder="مثال: 50"
                  />
                </label>

                <label>
                  حالة النشاط

                  <select name="status" defaultValue="PUBLISHED">
                    <option value="DRAFT">مسودة</option>
                    <option value="PUBLISHED">منشور</option>
                    <option value="ARCHIVED">مؤرشف</option>
                  </select>
                </label>
              </div>

              {isAdmin ? (
                <DepartmentChecklist
                  departments={departments.map(({ id, nameAr }) => ({
                    id,
                    nameAr,
                  }))}
                />
              ) : (
                <div className="admin-card">
                  <strong>القسم المستهدف</strong>

                  <p className="muted">
                    {user.department?.nameAr ?? "لا يوجد قسم مرتبط بالحساب"}
                  </p>

                  {user.departmentId && (
                    <input
                      type="hidden"
                      name="departmentIds"
                      value={user.departmentId}
                    />
                  )}
                </div>
              )}

              <ActivityFormBuilder />

              <button
                className="primary-btn"
                type="submit"
                disabled={!isAdmin && !user.departmentId}
              >
                حفظ النشاط ونموذج التسجيل
              </button>
            </form>
          </div>
        )}

        <div className="admin-card admin-list-card activities-panel">
          <div className="activities-panel-decoration" aria-hidden="true" />

          <div className="activities-panel-head">
            <div className="activities-panel-title">
              <h2>الأنشطة الحالية</h2>
              <p>
                استعرض الأنشطة بسرعة، وتابع النموذج والتسجيلات من نفس المكان.
              </p>
            </div>

            <span className="activities-count-badge">
              <strong>{activities.length}</strong>
              <span>نشاط</span>
            </span>
          </div>

          <div className="data-list activities-panel-list">
            {activities.length ? (
              activities.map((activity) => {
                const departmentNames = activity.departments.map(
                  (link) => link.department.nameAr,
                );

                const isGeneral = departmentNames.length === 0;
                const form = activity.registrationForm;

                return (
                  <article
                    className="data-row activity-admin-row activity-visual-card"
                    key={activity.id}
                  >

                    <div className="activity-admin-main">
                      <div className="activity-title-row">
                        <strong className="activity-title">{activity.title}</strong>

                        <span
                          className={`activity-status-badge status-${activity.status.toLowerCase()}`}
                        >
                          {statusLabels[activity.status]}
                        </span>
                      </div>

                      <div className="activity-info-box">
                        <div className="activity-info-row">
                          <span className="activity-info-item">
                            <span className="activity-info-dot" aria-hidden="true" />
                            {isGeneral
                              ? "عام · جميع الأقسام"
                              : departmentNames.join("، ")}
                          </span>

                          <span className="activity-info-item">
                            <span className="activity-info-dot" aria-hidden="true" />
                            {formatActivitySchedule(
                              activity.startsAt,
                              activity.endsAt,
                            )}
                          </span>
                        </div>

                        <div className="activity-info-row activity-info-form-row">
                          {form ? (
                            <>
                              <span className="activity-info-item">نموذج داخلي</span>
                              <span className="activity-info-item">
                                {form._count.questions} سؤال
                              </span>
                              <span className="activity-info-item">
                                {form._count.submissions} تسجيل
                              </span>
                              <span
                                className={
                                  form.isOpen
                                    ? "activity-info-item registration-state is-open"
                                    : "activity-info-item registration-state is-closed"
                                }
                              >
                                {form.isOpen ? "التسجيل مفتوح" : "التسجيل مغلق"}
                              </span>
                            </>
                          ) : (
                            <span className="activity-info-item registration-state is-empty">
                              لا يوجد نموذج تسجيل داخلي
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="activity-admin-row-actions">
                      {canManageActivities && (
                        <Link
                          href={`/admin/activities/${activity.id}/documentation`}
                          className="ghost-btn activity-manage-btn"
                        >
                          توثيق النشاط
                        </Link>
                      )}

                      {activity.registrationForm &&
                        canReviewRegistrations && (
                          <Link
                            href={`/admin/activities/${activity.id}/registrations`}
                            className="ghost-btn activity-manage-btn"
                          >
                            إدارة المسجلين
                          </Link>
                        )}

                      {canManageActivities && (
                        <DeleteActivityForm
                          id={activity.id}
                          title={activity.title}
                        />
                      )}
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="activities-empty-state">
                <span className="activities-empty-icon" aria-hidden="true">
                  ✦
                </span>
                <strong>لا توجد أنشطة حاليًا</strong>
                <p>ستظهر الأنشطة هنا فور إضافتها ضمن نطاق صلاحياتك.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <NonceStyle>{`
        .activities-admin-page .activity-form-panel {
          position: relative;
          isolation: isolate;
          overflow: hidden;
          border: 1px solid rgba(179, 204, 232, 0.72);
          background:
            radial-gradient(circle at 92% 4%, rgba(22, 136, 255, 0.16), transparent 29%),
            radial-gradient(circle at 7% 97%, rgba(53, 212, 255, 0.12), transparent 30%),
            linear-gradient(180deg, #ffffff 0%, #f7fbff 100%);
          box-shadow:
            0 24px 60px rgba(6, 24, 44, 0.09),
            inset 0 1px 0 rgba(255, 255, 255, 0.9);
        }

        .activities-admin-page .activity-form-panel::after {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -2;
          pointer-events: none;
          background-image:
            linear-gradient(rgba(22, 136, 255, 0.032) 1px, transparent 1px),
            linear-gradient(90deg, rgba(22, 136, 255, 0.032) 1px, transparent 1px);
          background-size: 28px 28px;
          mask-image: linear-gradient(to bottom, black, transparent 62%);
        }

        .activities-admin-page .activity-form-panel::before {
          content: "";
          position: absolute;
          top: -82px;
          left: -62px;
          z-index: -1;
          width: 190px;
          height: 190px;
          border: 28px solid rgba(22, 136, 255, 0.055);
          border-radius: 50%;
          pointer-events: none;
        }

        .activities-admin-page .activity-form-panel > * {
          position: relative;
          z-index: 1;
        }

        .activities-admin-page .activity-form-panel h2 {
          color: #0c2340;
        }

        /* Registration form builder visual refresh */
        .activities-admin-page .activity-form-builder {
          position: relative;
          isolation: isolate;
          overflow: hidden;
          margin-top: 28px;
          padding: 26px;
          border: 1px solid rgba(179, 204, 232, 0.78);
          border-radius: 22px;
          background:
            radial-gradient(circle at 92% 6%, rgba(22, 136, 255, 0.13), transparent 27%),
            radial-gradient(circle at 6% 96%, rgba(53, 212, 255, 0.09), transparent 28%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(247, 251, 255, 0.98) 100%);
          box-shadow:
            0 18px 42px rgba(6, 24, 44, 0.07),
            inset 0 1px 0 rgba(255, 255, 255, 0.96);
        }

        .activities-admin-page .activity-form-builder::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -2;
          pointer-events: none;
          background-image:
            linear-gradient(rgba(22, 136, 255, 0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(22, 136, 255, 0.025) 1px, transparent 1px);
          background-size: 26px 26px;
          mask-image: linear-gradient(to bottom, black, transparent 70%);
        }

        .activities-admin-page .activity-form-builder::after {
          content: "";
          position: absolute;
          top: -74px;
          left: -58px;
          z-index: -1;
          width: 170px;
          height: 170px;
          border: 24px solid rgba(22, 136, 255, 0.045);
          border-radius: 50%;
          pointer-events: none;
        }

        .activities-admin-page .activity-form-builder > * {
          position: relative;
          z-index: 1;
        }

        /* Remove the small internal-form label and the duplicate top add button */
        .activities-admin-page .activity-builder-eyebrow,
        .activities-admin-page .activity-builder-add {
          display: none !important;
        }

        .activities-admin-page .activity-builder-heading {
          display: block;
          padding-bottom: 18px;
          border-bottom-color: rgba(190, 207, 226, 0.78);
        }

        .activities-admin-page .activity-builder-heading h2 {
          margin: 0;
          color: #0c2340;
          font-size: 1.3rem;
        }

        .activities-admin-page .activity-builder-heading p {
          max-width: 620px;
          margin-top: 7px;
          color: #6b7c91;
        }

        .activities-admin-page .activity-builder-settings {
          gap: 15px 16px;
        }

        .activities-admin-page .activity-builder-settings input[type="text"],
        .activities-admin-page .activity-builder-settings textarea {
          border-color: rgba(190, 207, 226, 0.9);
          background: rgba(255, 255, 255, 0.86);
          transition:
            border-color 0.22s ease,
            box-shadow 0.22s ease,
            background 0.22s ease;
        }

        .activities-admin-page .activity-builder-settings input[type="text"]:hover,
        .activities-admin-page .activity-builder-settings textarea:hover {
          border-color: rgba(22, 136, 255, 0.34);
          background: #fff;
        }

        /* Keep the registration toggle text on the same line as its checkbox */
        .activities-admin-page .activity-builder-open-toggle {
          grid-column: 1 / -1;
          display: inline-flex !important;
          flex-direction: row !important;
          align-items: center !important;
          justify-content: flex-start !important;
          gap: 9px !important;
          width: fit-content !important;
          max-width: 100%;
          margin: 2px 0 0;
          padding: 10px 12px;
          border: 1px solid rgba(190, 207, 226, 0.75);
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.66);
          direction: rtl;
          cursor: pointer;
          transition:
            border-color 0.22s ease,
            background 0.22s ease,
            box-shadow 0.22s ease;
        }

        .activities-admin-page .activity-builder-open-toggle:hover {
          border-color: rgba(22, 136, 255, 0.32);
          background: rgba(237, 247, 255, 0.9);
          box-shadow: 0 8px 20px rgba(22, 136, 255, 0.08);
        }

        .activities-admin-page .activity-builder-open-toggle > input[type="checkbox"] {
          flex: 0 0 auto;
          width: 18px !important;
          height: 18px !important;
          margin: 0 !important;
        }

        .activities-admin-page .activity-builder-open-toggle > span {
          display: inline !important;
          margin: 0 !important;
          white-space: normal;
          color: #19314d;
          font-size: 0.78rem;
          font-weight: 700;
          line-height: 1.5;
        }

        html[data-theme="dark"] .activities-admin-page .activity-builder-open-toggle {
          border-color: rgba(91, 169, 224, 0.42) !important;
          background: #0c2a43 !important;
          box-shadow: inset 0 1px 0 rgba(157, 211, 248, 0.07) !important;
        }

        html[data-theme="dark"] .activities-admin-page .activity-builder-open-toggle:hover {
          border-color: rgba(103, 199, 255, 0.62) !important;
          background: #103550 !important;
          box-shadow: 0 8px 20px rgba(0, 7, 18, 0.24) !important;
        }

        html[data-theme="dark"] .activities-admin-page .activity-builder-open-toggle > span {
          color: #e7f2fb !important;
          font-weight: 800;
          opacity: 1 !important;
          text-shadow: none;
        }

        html[data-theme="dark"] .activities-admin-page .activity-builder-open-toggle > input[type="checkbox"] {
          accent-color: #1688ff;
          opacity: 1 !important;
          filter: none !important;
        }

        /* Question cards use the same soft club background language as the rest of the panel */
        .activities-admin-page .activity-builder-question {
          position: relative;
          isolation: isolate;
          overflow: hidden;
          padding: 20px;
          border: 1px solid rgba(179, 204, 232, 0.78);
          border-radius: 18px;
          background:
            radial-gradient(circle at 92% 4%, rgba(22, 136, 255, 0.11), transparent 30%),
            radial-gradient(circle at 8% 96%, rgba(53, 212, 255, 0.08), transparent 30%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(247, 251, 255, 0.98) 100%);
          box-shadow:
            0 14px 34px rgba(6, 24, 44, 0.065),
            inset 0 1px 0 rgba(255, 255, 255, 0.95);
          transition:
            transform 0.24s cubic-bezier(.22, 1, .36, 1),
            border-color 0.24s ease,
            box-shadow 0.24s ease;
        }

        .activities-admin-page .activity-builder-question::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -2;
          pointer-events: none;
          background-image:
            linear-gradient(rgba(22, 136, 255, 0.022) 1px, transparent 1px),
            linear-gradient(90deg, rgba(22, 136, 255, 0.022) 1px, transparent 1px);
          background-size: 24px 24px;
          mask-image: linear-gradient(to bottom, black, transparent 72%);
        }

        .activities-admin-page .activity-builder-question::after {
          content: "";
          position: absolute;
          top: -58px;
          left: -48px;
          z-index: -1;
          width: 135px;
          height: 135px;
          border: 21px solid rgba(22, 136, 255, 0.04);
          border-radius: 50%;
          pointer-events: none;
        }

        .activities-admin-page .activity-builder-question:hover {
          transform: translateY(-2px);
          border-color: rgba(22, 136, 255, 0.28);
          box-shadow:
            0 18px 38px rgba(6, 42, 78, 0.09),
            inset 0 1px 0 rgba(255, 255, 255, 0.98);
        }

        .activities-admin-page .activity-builder-question > * {
          position: relative;
          z-index: 1;
        }

        /* Question editor: put Placeholder and help note on separate full-width rows */
        .activities-admin-page .activity-builder-question > .activity-builder-grid:nth-of-type(3) {
          grid-template-columns: minmax(0, 1fr) !important;
          gap: 14px !important;
        }

        .activities-admin-page .activity-builder-question > .activity-builder-grid:nth-of-type(3) > .field {
          width: 100%;
          min-width: 0;
        }

        /* Keep the required checkbox directly beside its label */
        .activities-admin-page .activity-builder-required {
          display: inline-flex !important;
          flex-direction: row !important;
          align-items: center !important;
          justify-content: flex-start !important;
          gap: 9px !important;
          width: fit-content !important;
          max-width: 100%;
          margin-top: 14px;
          margin-inline-start: 0;
          margin-inline-end: auto;
          padding: 8px 10px;
          border-radius: 10px;
          direction: rtl;
          cursor: pointer;
          transition: background 0.2s ease, color 0.2s ease;
        }

        .activities-admin-page .activity-builder-required:hover {
          background: rgba(22, 136, 255, 0.07);
        }

        .activities-admin-page .activity-builder-required > input[type="checkbox"] {
          flex: 0 0 auto;
          width: 18px !important;
          height: 18px !important;
          margin: 0 !important;
        }

        .activities-admin-page .activity-builder-required > span {
          display: inline !important;
          margin: 0 !important;
          white-space: nowrap;
          color: #19314d;
          font-weight: 700;
          line-height: 1.5;
        }

        html[data-theme="dark"] .activities-admin-page .activity-builder-question {
          border-color: rgba(91, 169, 224, 0.38) !important;
          background:
            radial-gradient(circle at 92% 4%, rgba(22, 136, 255, 0.14), transparent 32%),
            radial-gradient(circle at 8% 96%, rgba(53, 212, 255, 0.08), transparent 30%),
            linear-gradient(180deg, #0d2b43 0%, #092238 100%) !important;
          color: #eaf4fb !important;
          box-shadow:
            0 16px 36px rgba(0, 7, 18, 0.3),
            inset 0 1px 0 rgba(157, 211, 248, 0.08) !important;
        }

        html[data-theme="dark"] .activities-admin-page .activity-builder-question::before {
          background-image:
            linear-gradient(rgba(103, 199, 255, 0.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(103, 199, 255, 0.045) 1px, transparent 1px);
        }

        html[data-theme="dark"] .activities-admin-page .activity-builder-question::after {
          border-color: rgba(103, 199, 255, 0.07);
        }

        html[data-theme="dark"] .activities-admin-page .activity-builder-question:hover {
          border-color: rgba(103, 199, 255, 0.58) !important;
          box-shadow:
            0 18px 42px rgba(0, 7, 18, 0.36),
            inset 0 1px 0 rgba(157, 211, 248, 0.11) !important;
        }

        html[data-theme="dark"] .activities-admin-page .activity-builder-question .field > label {
          color: #d8e8f4 !important;
          font-weight: 800;
          opacity: 1 !important;
        }

        html[data-theme="dark"] .activities-admin-page .activity-builder-question .field > input,
        html[data-theme="dark"] .activities-admin-page .activity-builder-question .field > textarea {
          border-color: rgba(91, 169, 224, 0.4) !important;
          background: #071e31 !important;
          color: #f2f8fc !important;
          box-shadow: inset 0 1px 0 rgba(157, 211, 248, 0.04) !important;
          caret-color: #67c7ff;
        }

        html[data-theme="dark"] .activities-admin-page .activity-builder-question .field > input:hover,
        html[data-theme="dark"] .activities-admin-page .activity-builder-question .field > textarea:hover {
          border-color: rgba(103, 199, 255, 0.62) !important;
          background: #09263d !important;
        }

        html[data-theme="dark"] .activities-admin-page .activity-builder-question .field > input:focus,
        html[data-theme="dark"] .activities-admin-page .activity-builder-question .field > textarea:focus {
          border-color: #36aef7 !important;
          box-shadow: 0 0 0 3px rgba(54, 174, 247, 0.16) !important;
        }

        html[data-theme="dark"] .activities-admin-page .activity-builder-question .field > input::placeholder,
        html[data-theme="dark"] .activities-admin-page .activity-builder-question .field > textarea::placeholder {
          color: #91a9bd !important;
          opacity: 1;
        }

        html[data-theme="dark"] .activities-admin-page .activity-builder-question-number {
          border-color: rgba(91, 169, 224, 0.4) !important;
          background: #0b263d !important;
          color: #dcebf6 !important;
          box-shadow: 0 8px 20px rgba(0, 7, 18, 0.24) !important;
        }

        html[data-theme="dark"] .activities-admin-page .activity-builder-question-number-label {
          color: #b9d9ef !important;
        }

        html[data-theme="dark"] .activities-admin-page .activity-builder-question-actions button {
          border-color: rgba(91, 169, 224, 0.38) !important;
          background: #0b2a43 !important;
          color: #8fd3ff !important;
          box-shadow: none !important;
        }

        html[data-theme="dark"] .activities-admin-page .activity-builder-question-actions button:hover:not(:disabled) {
          border-color: rgba(103, 199, 255, 0.65) !important;
          background: #123b59 !important;
          color: #dff4ff !important;
        }

        html[data-theme="dark"] .activities-admin-page .activity-builder-question-actions button:disabled {
          color: #7891a5 !important;
          opacity: 0.52;
        }

        html[data-theme="dark"] .activities-admin-page .activity-builder-question-actions button.danger {
          border-color: rgba(255, 126, 139, 0.42) !important;
          background: rgba(135, 37, 45, 0.24) !important;
          color: #ff9da6 !important;
        }

        html[data-theme="dark"] .activities-admin-page .activity-builder-required {
          border-color: rgba(91, 169, 224, 0.35) !important;
          background: #0a263d !important;
          color: #e7f2fb !important;
        }

        html[data-theme="dark"] .activities-admin-page .activity-builder-required:hover {
          border-color: rgba(103, 199, 255, 0.56) !important;
          background: #103550 !important;
        }

        html[data-theme="dark"] .activities-admin-page .activity-builder-required > span {
          color: #e7f2fb !important;
          font-weight: 800;
          opacity: 1 !important;
        }

        html[data-theme="dark"] .activities-admin-page .activity-builder-required > input[type="checkbox"] {
          accent-color: #1688ff;
          opacity: 1 !important;
          filter: none !important;
        }

        .activities-admin-page .activity-builder-empty {
          border-color: rgba(190, 207, 226, 0.78);
          background:
            linear-gradient(180deg, rgba(249, 252, 255, 0.88), rgba(243, 248, 253, 0.92));
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
        }

        /* Club-logo hover: blue + cyan + orange */
        .activities-admin-page .activity-builder-empty-btn {
          border: 1px solid rgba(22, 136, 255, 0.16);
          border-radius: 12px;
          background: linear-gradient(115deg, #0b72df 0%, #1688ff 38%, #24b8ee 72%, #35d4ff 100%);
          background-size: 160% 160%;
          background-position: 18% 50%;
          color: #fff;
          box-shadow:
            0 10px 22px rgba(22, 136, 255, 0.22),
            0 3px 12px rgba(53, 212, 255, 0.11);
          transition:
            transform 0.24s cubic-bezier(.22, 1, .36, 1),
            box-shadow 0.24s ease,
            border-color 0.24s ease,
            background-position 0.38s ease;
        }

        .activities-admin-page .activity-builder-empty-btn:hover {
          transform: translateY(-3px) scale(1.015);
          border-color: rgba(255, 139, 50, 0.52);
          background: linear-gradient(
            115deg,
            #1688ff 0%,
            #21bdf4 48%,
            #35d4ff 63%,
            #ff8b32 100%
          );
          background-size: 180% 180%;
          background-position: 100% 50%;
          box-shadow:
            0 14px 30px rgba(22, 136, 255, 0.24),
            0 7px 20px rgba(255, 139, 50, 0.16);
        }

        .activities-admin-page .activity-builder-empty-btn:active {
          transform: translateY(-1px) scale(0.99);
        }

        /* Replace the dashed full-width "add another question" control with a polished CTA */
        .activities-admin-page .activity-builder-add-bottom {
          position: relative;
          overflow: hidden;
          width: fit-content !important;
          min-width: 215px;
          max-width: 100%;
          min-height: 48px;
          margin: 20px auto 0 !important;
          padding: 11px 20px !important;
          display: inline-flex !important;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 1px solid rgba(22, 136, 255, 0.18) !important;
          border-radius: 14px !important;
          background: linear-gradient(112deg, #075fc9 0%, #1688ff 38%, #20b9ef 72%, #35d4ff 100%) !important;
          background-size: 175% 175% !important;
          background-position: 16% 50% !important;
          color: #fff !important;
          box-shadow:
            0 12px 28px rgba(22, 136, 255, 0.22),
            0 4px 14px rgba(53, 212, 255, 0.1);
          font-family: "Alexandria", sans-serif;
          font-size: 0.78rem;
          font-weight: 700;
          cursor: pointer;
          transition:
            transform 0.24s cubic-bezier(.22, 1, .36, 1),
            box-shadow 0.24s ease,
            border-color 0.24s ease,
            background-position 0.4s ease;
        }

        .activities-admin-page .activity-builder-add-bottom::before {
          content: "";
          position: absolute;
          top: -45%;
          left: -28%;
          width: 34%;
          height: 190%;
          pointer-events: none;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.42), transparent);
          transform: rotate(18deg) translateX(-220%);
          transition: transform 0.55s ease;
        }

        .activities-admin-page .activity-builder-add-bottom svg {
          position: relative;
          z-index: 1;
          transition: transform 0.3s cubic-bezier(.22, 1, .36, 1);
        }

        .activities-admin-page .activity-builder-add-bottom:hover {
          transform: translateY(-3px) scale(1.015);
          border-color: rgba(255, 139, 50, 0.5) !important;
          background: linear-gradient(112deg, #1688ff 0%, #14aaf0 44%, #35d4ff 67%, #ff8b32 100%) !important;
          background-size: 190% 190% !important;
          background-position: 100% 50% !important;
          box-shadow:
            0 16px 34px rgba(22, 136, 255, 0.26),
            0 8px 22px rgba(255, 139, 50, 0.15);
        }

        .activities-admin-page .activity-builder-add-bottom:hover::before {
          transform: rotate(18deg) translateX(520%);
        }

        .activities-admin-page .activity-builder-add-bottom:hover svg {
          transform: rotate(90deg) scale(1.08);
        }

        .activities-admin-page .activity-builder-add-bottom:active {
          transform: translateY(-1px) scale(0.99);
        }

        .activities-admin-page .activity-builder-add-bottom:focus-visible {
          outline: 3px solid rgba(22, 136, 255, 0.28);
          outline-offset: 3px;
        }

        /* Main save button gets the same club-logo hover language */
        .activities-admin-page .activity-form-panel > .stack-form > .primary-btn {
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(22, 136, 255, 0.18);
          background: linear-gradient(110deg, #075fc9 0%, #1688ff 34%, #20b9ef 70%, #35d4ff 100%);
          background-size: 170% 170%;
          background-position: 16% 50%;
          box-shadow:
            0 13px 30px rgba(22, 136, 255, 0.25),
            0 4px 16px rgba(53, 212, 255, 0.12);
          transition:
            transform 0.24s cubic-bezier(.22, 1, .36, 1),
            box-shadow 0.24s ease,
            border-color 0.24s ease,
            background-position 0.4s ease;
        }

        .activities-admin-page .activity-form-panel > .stack-form > .primary-btn:hover:not(:disabled) {
          transform: translateY(-3px);
          border-color: rgba(255, 139, 50, 0.48);
          background: linear-gradient(
            110deg,
            #1688ff 0%,
            #0da9ee 42%,
            #35d4ff 64%,
            #ff8b32 100%
          );
          background-size: 190% 190%;
          background-position: 100% 50%;
          box-shadow:
            0 17px 36px rgba(22, 136, 255, 0.27),
            0 8px 24px rgba(255, 139, 50, 0.17);
        }

        .activities-admin-page .activity-form-panel > .stack-form > .primary-btn:active:not(:disabled) {
          transform: translateY(-1px) scale(0.995);
        }

        .activities-admin-page .activity-form-panel .department-checklist-head {
          display: grid !important;
          grid-template-columns: auto minmax(0, 1fr);
          grid-template-rows: auto auto;
          align-items: center;
          column-gap: 8px;
          row-gap: 2px;
        }

        .activities-admin-page .activity-form-panel .department-checklist-head > input[type="checkbox"] {
          grid-column: 1;
          grid-row: 1;
          align-self: center;
        }

        .activities-admin-page .activity-form-panel .department-checklist-head > span {
          display: contents;
        }

        .activities-admin-page .activity-form-panel .department-checklist-head > span > strong {
          grid-column: 2;
          grid-row: 1;
          align-self: center;
        }

        .activities-admin-page .activity-form-panel .department-checklist-head > span > small {
          grid-column: 2;
          grid-row: 2;
          margin: 0;
        }

        .activities-admin-page .activities-panel {
          position: relative;
          isolation: isolate;
          overflow: hidden;
          container-type: inline-size;
          border: 1px solid rgba(179, 204, 232, 0.72);
          background:
            radial-gradient(circle at 92% 4%, rgba(22, 136, 255, 0.16), transparent 29%),
            radial-gradient(circle at 7% 97%, rgba(53, 212, 255, 0.12), transparent 30%),
            linear-gradient(180deg, #ffffff 0%, #f7fbff 100%);
          box-shadow:
            0 24px 60px rgba(6, 24, 44, 0.09),
            inset 0 1px 0 rgba(255, 255, 255, 0.9);
        }

        .activities-admin-page .activities-panel::after {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -2;
          pointer-events: none;
          background-image:
            linear-gradient(rgba(22, 136, 255, 0.032) 1px, transparent 1px),
            linear-gradient(90deg, rgba(22, 136, 255, 0.032) 1px, transparent 1px);
          background-size: 28px 28px;
          mask-image: linear-gradient(to bottom, black, transparent 62%);
        }

        .activities-admin-page .activities-panel-decoration {
          position: absolute;
          top: -82px;
          left: -62px;
          z-index: -1;
          width: 190px;
          height: 190px;
          border: 28px solid rgba(22, 136, 255, 0.055);
          border-radius: 50%;
          pointer-events: none;
        }

        .activities-admin-page .activities-panel-head {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
          padding-bottom: 17px;
          border-bottom: 1px solid rgba(190, 207, 226, 0.7);
        }

        .activities-admin-page .activities-panel-title {
          min-width: 0;
        }

        .activities-admin-page .activities-panel-kicker {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 6px;
          color: #1688ff;
          font-family: "Alexandria", sans-serif;
          font-size: 0.64rem;
          font-weight: 700;
        }

        .activities-admin-page .activities-panel-kicker::before {
          content: "";
          width: 7px;
          height: 7px;
          border-radius: 999px;
          background: linear-gradient(135deg, #1688ff, #35d4ff);
          box-shadow: 0 0 0 5px rgba(22, 136, 255, 0.09);
        }

        .activities-admin-page .activities-panel-head h2 {
          margin: 0;
          color: #0c2340;
          font-size: 1.08rem;
        }

        .activities-admin-page .activities-panel-head p {
          max-width: 390px;
          margin: 7px 0 0;
          color: #6b7c91;
          font-size: 0.76rem;
          line-height: 1.8;
        }

        .activities-admin-page .activities-count-badge {
          flex: 0 0 auto;
          min-width: 66px;
          padding: 10px 13px;
          display: grid;
          justify-items: center;
          gap: 1px;
          border: 1px solid rgba(22, 136, 255, 0.16);
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.76);
          box-shadow: 0 10px 28px rgba(9, 45, 82, 0.07);
          backdrop-filter: blur(10px);
          color: #66768c;
          font-family: "Alexandria", sans-serif;
          font-size: 0.62rem;
        }

        .activities-admin-page .activities-count-badge strong {
          color: #0875df;
          font-family: "Manrope", sans-serif;
          font-size: 1.15rem;
          line-height: 1.15;
        }

        .activities-admin-page .activities-panel-list {
          position: relative;
          z-index: 1;
          gap: 13px;
          margin-top: 17px;
        }

        .activities-admin-page .activity-visual-card {
          position: relative;
          overflow: hidden;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 164px;
          align-items: stretch;
          gap: 18px;
          padding: 16px 17px;
          border: 1px solid rgba(198, 214, 232, 0.86);
          border-inline-start: 4px solid #1688ff;
          border-radius: 17px;
          background: rgba(255, 255, 255, 0.82);
          box-shadow:
            0 8px 24px rgba(6, 24, 44, 0.045),
            inset 0 1px 0 rgba(255, 255, 255, 0.96);
          backdrop-filter: blur(10px);
          transition:
            transform 0.25s cubic-bezier(.22, 1, .36, 1),
            border-color 0.25s ease,
            background 0.25s ease,
            box-shadow 0.25s ease;
        }

        .activities-admin-page .activity-visual-card::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0;
          background: linear-gradient(
            120deg,
            rgba(22, 136, 255, 0.045),
            rgba(53, 212, 255, 0.02) 48%,
            transparent 70%
          );
          transition: opacity 0.25s ease;
        }

        .activities-admin-page .activity-visual-card:hover {
          transform: translateY(-4px);
          border-color: rgba(22, 136, 255, 0.36);
          border-inline-start-color: #1688ff;
          background: rgba(255, 255, 255, 0.96);
          box-shadow:
            0 17px 38px rgba(6, 42, 78, 0.11),
            0 2px 8px rgba(22, 136, 255, 0.05);
        }

        .activities-admin-page .activity-visual-card:hover::after {
          opacity: 1;
        }


        .activities-admin-page .activity-admin-main {
          position: relative;
          z-index: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding-inline-start: 7px;
        }

        .activities-admin-page .activity-title-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 11px;
          margin-bottom: 8px;
        }

        .activities-admin-page .activity-title {
          min-width: 0;
          display: block;
          margin: 0;
          color: #102139;
          font-size: 0.88rem;
          line-height: 1.55;
          overflow-wrap: anywhere;
        }

        .activities-admin-page .activity-status-badge {
          flex: 0 0 auto;
          min-height: 28px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 5px 10px;
          border: 1px solid transparent;
          border-radius: 999px;
          font-family: "Alexandria", sans-serif;
          font-size: 0.62rem;
          font-weight: 700;
          line-height: 1.45;
        }

        .activities-admin-page .status-published {
          border-color: #bfe9d2;
          background: #eafff2;
          color: #087846;
        }

        .activities-admin-page .status-draft {
          border-color: #f1d595;
          background: #fff8e8;
          color: #8c6208;
        }

        .activities-admin-page .status-archived {
          border-color: #d8e0e9;
          background: #f2f5f8;
          color: #627184;
        }

        .activities-admin-page .activity-info-box {
          margin-top: 10px;
          padding: 10px 12px;
          border: 1px solid rgba(204, 219, 234, 0.9);
          border-radius: 13px;
          background: linear-gradient(180deg, rgba(248, 251, 255, 0.96), rgba(244, 249, 254, 0.9));
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
          transition:
            border-color 0.22s ease,
            background 0.22s ease,
            box-shadow 0.22s ease;
        }

        .activities-admin-page .activity-visual-card:hover .activity-info-box {
          border-color: rgba(22, 136, 255, 0.25);
          background: #ffffff;
          box-shadow: 0 6px 18px rgba(13, 62, 107, 0.055);
        }

        .activities-admin-page .activity-info-row {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          align-items: center;
          gap: 0;
          color: #617289;
          font-size: 0.7rem;
          line-height: 1.7;
        }

        .activities-admin-page .activity-info-form-row {
          grid-template-columns: repeat(4, minmax(0, 1fr));
          margin-top: 7px;
          padding-top: 7px;
          border-top: 1px solid rgba(214, 225, 237, 0.86);
        }

        .activities-admin-page .activity-info-form-row .activity-info-item {
          width: 100%;
          justify-content: center;
          text-align: center;
          white-space: normal;
        }

        .activities-admin-page .activity-info-form-row .activity-info-item:only-child {
          grid-column: 1 / -1;
          justify-content: flex-start;
          text-align: start;
        }

        .activities-admin-page .activity-info-item {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-width: 0;
          padding-inline: 9px;
          color: #617289;
          overflow-wrap: normal;
          word-break: normal;
        }

        .activities-admin-page .activity-info-item:first-child {
          padding-inline-start: 0;
        }

        .activities-admin-page .activity-info-item + .activity-info-item::before {
          content: "";
          width: 1px;
          height: 15px;
          margin-inline-end: 1px;
          background: #d8e3ee;
        }

        .activities-admin-page .activity-info-dot {
          flex: 0 0 auto;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #78aee3;
          box-shadow: 0 0 0 3px rgba(120, 174, 227, 0.12);
        }

        .activities-admin-page .activity-info-box .registration-state.is-open {
          color: #087846;
          font-weight: 700;
        }

        .activities-admin-page .activity-info-box .registration-state.is-closed {
          color: #a33b3b;
          font-weight: 700;
        }

        .activities-admin-page .activity-info-box .registration-state.is-empty {
          color: #77869a;
        }

        html[data-theme="dark"] .activities-admin-page .activity-info-box {
          border-color: rgba(91, 169, 224, 0.34) !important;
          background: #0a263d !important;
          color: #d7e6f3 !important;
          box-shadow:
            inset 0 1px 0 rgba(157, 211, 248, 0.08),
            0 8px 20px rgba(0, 7, 18, 0.2) !important;
        }

        html[data-theme="dark"] .activities-admin-page .activity-visual-card:hover .activity-info-box {
          border-color: rgba(99, 190, 255, 0.52) !important;
          background: #0d2d47 !important;
          box-shadow:
            inset 0 1px 0 rgba(157, 211, 248, 0.1),
            0 10px 24px rgba(0, 7, 18, 0.26) !important;
        }

        html[data-theme="dark"] .activities-admin-page .activity-info-row,
        html[data-theme="dark"] .activities-admin-page .activity-info-item {
          color: #c6d9e9 !important;
          font-size: 0.74rem;
          font-weight: 600;
          line-height: 1.8;
          text-shadow: none;
        }

        html[data-theme="dark"] .activities-admin-page .activity-info-form-row {
          border-top-color: rgba(153, 195, 226, 0.34);
        }

        html[data-theme="dark"] .activities-admin-page .activity-info-item + .activity-info-item::before {
          background: rgba(164, 205, 234, 0.48);
        }

        html[data-theme="dark"] .activities-admin-page .activity-info-dot {
          background: #67c7ff;
          box-shadow: 0 0 0 3px rgba(103, 199, 255, 0.18);
        }

        html[data-theme="dark"] .activities-admin-page .activity-info-box .registration-state.is-open {
          color: #58e092 !important;
          font-weight: 800;
        }

        html[data-theme="dark"] .activities-admin-page .activity-info-box .registration-state.is-closed {
          color: #ff8f99 !important;
          font-weight: 800;
        }

        html[data-theme="dark"] .activities-admin-page .activity-info-box .registration-state.is-empty {
          color: #b5c8d9 !important;
        }

        .activities-admin-page .activity-admin-row-actions {
          position: relative;
          z-index: 2;
          width: 164px;
          min-width: 164px;
          height: 156px;
          min-height: 156px;
          display: grid;
          grid-auto-rows: 46px;
          align-content: center;
          gap: 9px;
        }

        .activities-admin-page .activity-admin-row-actions form {
          width: 100%;
          height: 46px;
          min-width: 0;
          margin: 0;
        }

        .activities-admin-page .activity-admin-row-actions .ghost-btn,
        .activities-admin-page .activity-admin-row-actions .danger-btn {
          width: 100%;
          height: 46px;
          min-width: 0;
          min-height: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          white-space: nowrap;
          border-radius: 11px;
          transition:
            transform 0.22s cubic-bezier(.22, 1, .36, 1),
            color 0.22s ease,
            background 0.22s ease,
            border-color 0.22s ease,
            box-shadow 0.22s ease;
        }

        .activities-admin-page .activity-admin-row-actions .ghost-btn {
          border-color: #c8d9eb;
          background: rgba(255, 255, 255, 0.92);
          color: #24415f;
          box-shadow: 0 5px 14px rgba(12, 46, 80, 0.045);
        }

        .activities-admin-page .activity-admin-row-actions .ghost-btn:hover {
          transform: translateY(-2px);
          border-color: #8cc2f4;
          background: #edf7ff;
          color: #0875df;
          box-shadow: 0 10px 22px rgba(22, 136, 255, 0.15);
        }

        .activities-admin-page .activity-admin-row-actions .ghost-btn:active {
          transform: translateY(0) scale(0.98);
        }

        .activities-admin-page .activity-admin-row-actions .danger-btn {
          border: 1px solid #f4cccc;
          background: #fff2f2;
          color: #a52b2b;
          box-shadow: none;
        }

        .activities-admin-page .activity-admin-row-actions .danger-btn:hover {
          transform: translateY(-2px);
          border-color: #eaa7a7;
          background: #ffe4e4;
          color: #8f1e1e;
          box-shadow: 0 10px 22px rgba(181, 50, 50, 0.13);
        }

        .activities-admin-page .activity-admin-row-actions .danger-btn:active {
          transform: translateY(0) scale(0.98);
        }

        .activities-admin-page .activities-empty-state {
          min-height: 220px;
          padding: 30px 20px;
          display: grid;
          place-items: center;
          align-content: center;
          gap: 6px;
          border: 1px dashed #c8d9eb;
          border-radius: 17px;
          background: rgba(255, 255, 255, 0.62);
          text-align: center;
        }

        .activities-admin-page .activities-empty-icon {
          width: 48px;
          height: 48px;
          margin-bottom: 4px;
          display: grid;
          place-items: center;
          border-radius: 15px;
          background: linear-gradient(135deg, #eaf5ff, #f3fbff);
          color: #1688ff;
          box-shadow: 0 10px 24px rgba(22, 136, 255, 0.1);
          font-size: 1.2rem;
        }

        .activities-admin-page .activities-empty-state strong {
          font-family: "Alexandria", sans-serif;
          color: #18324f;
          font-size: 0.86rem;
        }

        .activities-admin-page .activities-empty-state p {
          color: #75869a;
          font-size: 0.74rem;
        }

        @media (max-width: 820px) {
          .activities-admin-page .activities-panel-head {
            align-items: center;
          }
        }

        @container (max-width: 620px) {
          .activities-admin-page .activity-visual-card {
            grid-template-columns: minmax(0, 1fr);
          }

          .activities-admin-page .activity-admin-row-actions {
            width: 100%;
            min-width: 0;
            height: auto;
            min-height: 0;
            grid-template-columns: repeat(auto-fit, minmax(145px, 1fr));
            grid-auto-rows: 46px;
            align-content: start;
          }

          .activities-admin-page .activity-info-form-row {
            grid-template-columns: repeat(4, minmax(max-content, 1fr));
          }

          .activities-admin-page .activity-info-form-row .activity-info-item {
            white-space: nowrap;
            overflow-wrap: normal;
            word-break: normal;
          }
        }

        @container (max-width: 470px) {
          .activities-admin-page .activity-info-form-row {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            row-gap: 8px;
          }

          .activities-admin-page .activity-info-form-row .activity-info-item {
            white-space: normal;
            overflow-wrap: normal;
            word-break: normal;
          }

          .activities-admin-page .activity-admin-row-actions {
            grid-template-columns: minmax(0, 1fr);
          }
        }

        @media (max-width: 680px) {
          .activities-admin-page .activity-info-form-row {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            row-gap: 8px;
          }

.activities-admin-page .activity-info-form-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 16px;
  margin-top: 7px;
  padding-top: 10px;
  border-top: 1px solid rgba(214, 225, 237, 0.18);
}

.activities-admin-page .activity-info-form-row .activity-info-item {
  width: 100%;
  padding-inline: 0;
  justify-content: flex-start;
  text-align: start;
  white-space: normal;
}

.activities-admin-page .activity-info-form-row .activity-info-item::before,
.activities-admin-page .activity-info-form-row .activity-info-item + .activity-info-item::before,
.activities-admin-page .activity-info-form-row .activity-info-item:nth-child(even)::before {
  display: none !important;
}
        }

        @media (max-width: 560px) {
          .activities-admin-page .activities-panel {
            padding: 16px;
          }

          .activities-admin-page .activities-panel-head {
            align-items: flex-start;
            flex-direction: column;
          }

          .activities-admin-page .activities-count-badge {
            min-width: 0;
            display: inline-flex;
            align-items: baseline;
            gap: 5px;
            padding: 7px 11px;
          }

          .activities-admin-page .activity-title-row {
            align-items: flex-start;
            flex-direction: column;
          }

          .activities-admin-page .activity-status-badge {
            align-self: flex-start;
          }

          .activities-admin-page .activity-info-row {
            align-items: flex-start;
            grid-template-columns: minmax(0, 1fr);
            gap: 5px;
          }

          .activities-admin-page .activity-info-form-row {
            display: grid;
            align-items: center;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px 0;
          }

          .activities-admin-page .activity-info-form-row .activity-info-item {
            width: 100%;
            padding-inline: 6px;
            white-space: normal;
          }

          .activities-admin-page .activity-info-form-row .activity-info-item:first-child {
            padding-inline-start: 0;
          }

          .activities-admin-page .activity-info-form-row .activity-info-item:nth-child(even)::before {
            display: block;
          }

          .activities-admin-page .activity-info-item {
            width: 100%;
            padding-inline: 0;
          }

          .activities-admin-page .activity-info-item + .activity-info-item::before {
            display: none;
          }

          .activities-admin-page .activity-admin-row-actions {
            grid-template-columns: minmax(0, 1fr);
          }
        }

        @media (min-width: 681px) {
  .activities-admin-page .activity-info-form-row {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px 14px;
  }
}

        @media (max-width: 560px) {
          .activities-admin-page .activity-form-builder {
            padding: 18px;
            border-radius: 18px;
          }

          .activities-admin-page .activity-builder-open-toggle {
            width: 100% !important;
          }
        }

        @media (max-width: 560px) {
          .activities-admin-page .activity-builder-add-bottom {
            width: 100% !important;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .activities-admin-page .activity-visual-card,
          .activities-admin-page .activity-builder-question,
          .activities-admin-page .activity-builder-add-bottom,
          .activities-admin-page .activity-builder-add-bottom svg,
          .activities-admin-page .activity-admin-row-actions .ghost-btn,
          .activities-admin-page .activity-admin-row-actions .danger-btn {
            transition: none;
          }

          .activities-admin-page .activity-visual-card:hover,
          .activities-admin-page .activity-builder-question:hover,
          .activities-admin-page .activity-builder-add-bottom:hover,
          .activities-admin-page .activity-builder-add-bottom:hover svg,
          .activities-admin-page .activity-admin-row-actions .ghost-btn:hover,
          .activities-admin-page .activity-admin-row-actions .danger-btn:hover {
            transform: none;
          }
        }
      `}</NonceStyle>
    </section>
  );
}