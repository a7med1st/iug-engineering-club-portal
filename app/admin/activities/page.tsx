import Link from "next/link";

import ActivityFormBuilder from "@/components/admin/ActivityFormBuilder";
import AdminFeedback from "@/components/admin/AdminFeedback";
import DeleteActivityForm from "@/components/admin/DeleteActivityForm";
import DepartmentChecklist from "@/components/admin/DepartmentChecklist";

import {
  ACTIVITY_ADMIN_PERMISSIONS,
  PERMISSIONS,
  canAccessActivityDepartments,
  hasPermission,
  requireAnyPermission,
} from "@/lib/permissions";

import { prisma } from "@/lib/prisma";

import {
  createActivity,
} from "../actions";

export const dynamic =
  "force-dynamic";

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
  const { user } =
    await requireAnyPermission(
      ACTIVITY_ADMIN_PERMISSIONS,
    );

  const feedback =
    await searchParams;

  const isAdmin =
    user.role === "ADMIN";

  const canManageActivities =
    hasPermission(
      user.role,
      PERMISSIONS.ACTIVITY_MANAGE,
      user.memberPermissions,
    );

  const canReviewRegistrations =
    hasPermission(
      user.role,
      PERMISSIONS.REGISTRATION_REVIEW,
      user.memberPermissions,
    );

  const departments =
    isAdmin
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

  const rawActivities =
    await prisma.activity.findMany({
      where:
        isAdmin ||
        !user.departmentId
          ? undefined
          : {
              departments: {
                some: {
                  departmentId:
                    user.departmentId,
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

  const activities =
    rawActivities.filter(
      (activity) =>
        canAccessActivityDepartments(
          user,
          activity.departments.map(
            (link) =>
              link.departmentId,
          ),
        ),
    );

  return (
    <section className="admin-page">
      <div className="admin-page-head">
        <div>
          <h1>
            {isAdmin
              ? "إدارة الأنشطة"
              : "أنشطة القسم"}
          </h1>

          <p className="muted">
            {isAdmin
              ? "أنشئ الأنشطة وحدد الأقسام المستهدفة، ثم تابع التسجيلات."
              : `يمكنك إدارة الأنشطة المرتبطة حصريًا بقسم ${
                  user.department?.nameAr ??
                  "المحدد لحسابك"
                } فقط.`}
          </p>
        </div>
      </div>

      <AdminFeedback
        error={feedback.error}
        success={feedback.success}
      />

      <div className="admin-content-grid">
        {canManageActivities && (
          <div className="admin-card">
            <h2>
              بيانات النشاط
            </h2>

            <form
              action={
                createActivity
              }
              className="stack-form"
            >
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

              <div className="form-grid">
                <label>
                  تاريخ ووقت النشاط

                  <input
                    type="datetime-local"
                    name="startsAt"
                    required
                  />
                </label>

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

                  <select
                    name="status"
                    defaultValue="PUBLISHED"
                  >
                    <option value="DRAFT">
                      مسودة
                    </option>

                    <option value="PUBLISHED">
                      منشور
                    </option>

                    <option value="ARCHIVED">
                      مؤرشف
                    </option>
                  </select>
                </label>
              </div>

              {isAdmin ? (
                <DepartmentChecklist
                  departments={departments.map(
                    ({
                      id,
                      nameAr,
                    }) => ({
                      id,
                      nameAr,
                    }),
                  )}
                />
              ) : (
                <div className="admin-card">
                  <strong>
                    القسم المستهدف
                  </strong>

                  <p className="muted">
                    {user.department
                      ?.nameAr ??
                      "لا يوجد قسم مرتبط بالحساب"}
                  </p>

                  {user.departmentId && (
                    <input
                      type="hidden"
                      name="departmentIds"
                      value={
                        user.departmentId
                      }
                    />
                  )}
                </div>
              )}

              <ActivityFormBuilder />

              <button
                className="primary-btn"
                type="submit"
                disabled={
                  !isAdmin &&
                  !user.departmentId
                }
              >
                حفظ النشاط ونموذج التسجيل
              </button>
            </form>
          </div>
        )}

        <div className="admin-card admin-list-card">
          <h2>
            الأنشطة الحالية
          </h2>

          <div className="data-list">
            {activities.length ? (
              activities.map(
                (activity) => {
                  const departmentNames =
                    activity.departments.map(
                      (link) =>
                        link.department
                          .nameAr,
                    );

                  const isGeneral =
                    departmentNames.length ===
                    0;

                  const form =
                    activity.registrationForm;

                  return (
                    <article
                      className="data-row activity-admin-row"
                      key={
                        activity.id
                      }
                    >
                      <div>
                        <strong>
                          {
                            activity.title
                          }
                        </strong>

                        <div className="data-row-meta">
                          <span>
                            {isGeneral
                              ? "عام · جميع الأقسام"
                              : departmentNames.join(
                                  "، ",
                                )}
                          </span>

                          <span>
                            {new Intl.DateTimeFormat(
                              "ar-PS",
                              {
                                dateStyle:
                                  "medium",
                                timeStyle:
                                  "short",
                              },
                            ).format(
                              activity.startsAt,
                            )}
                          </span>

                          <span>
                            {
                              statusLabels[
                                activity
                                  .status
                              ]
                            }
                          </span>
                        </div>

                        <div className="activity-admin-form-meta">
                          {form ? (
                            <>
                              <span>
                                نموذج داخلي
                              </span>

                              <span>
                                {
                                  form
                                    ._count
                                    .questions
                                }{" "}
                                سؤال
                              </span>

                              <span>
                                {
                                  form
                                    ._count
                                    .submissions
                                }{" "}
                                تسجيل
                              </span>

                              <span>
                                {form.isOpen
                                  ? "التسجيل مفتوح"
                                  : "التسجيل مغلق"}
                              </span>
                            </>
                          ) : (
                            <span>
                              لا يوجد نموذج تسجيل داخلي
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="activity-admin-row-actions">
                        {activity.registrationForm &&
                          canReviewRegistrations && (
                            <Link
                              href={`/admin/activities/${activity.id}/registrations`}
                              className="ghost-btn"
                            >
                              إدارة المسجلين
                            </Link>
                          )}

                        {canManageActivities && (
                          <DeleteActivityForm
                            id={
                              activity.id
                            }
                            title={
                              activity.title
                            }
                          />
                        )}
                      </div>
                    </article>
                  );
                },
              )
            ) : (
              <p className="empty-state">
                لا توجد أنشطة متاحة ضمن نطاق صلاحياتك.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
