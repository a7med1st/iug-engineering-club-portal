import ActivityFormBuilder from "@/components/admin/ActivityFormBuilder";
import AdminFeedback from "@/components/admin/AdminFeedback";
import DeleteActivityForm from "@/components/admin/DeleteActivityForm";
import DepartmentChecklist from "@/components/admin/DepartmentChecklist";
import Link from "next/link";

import { prisma } from "@/lib/prisma";

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
  const feedback = await searchParams;

  const [departments, activities] =
    await Promise.all([
      prisma.department.findMany({
        orderBy: {
          sortOrder: "asc",
        },
      }),

      prisma.activity.findMany({
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
      }),
    ]);

  return (
    <section className="admin-page">

      {/* =====================================================
          PAGE HEADER
      ===================================================== */}

      <div className="admin-page-head">

        <div>
          <h1>
            إضافة نشاط
          </h1>

          <p className="muted">
            أنشئ النشاط وحدد الأقسام
            المستهدفة، ثم صمّم نموذج
            التسجيل الخاص بالنشاط من
            داخل الموقع.
          </p>
        </div>

      </div>


      {/* =====================================================
          FEEDBACK
      ===================================================== */}

      <AdminFeedback
        error={feedback.error}
        success={feedback.success}
      />


      {/* =====================================================
          CONTENT
      ===================================================== */}

      <div className="admin-content-grid">

        {/* ===================================================
            CREATE ACTIVITY
        =================================================== */}

        <div className="admin-card">

          <h2>
            بيانات النشاط
          </h2>


          <form
            action={createActivity}
            className="stack-form"
          >

            {/* ===============================================
                BASIC INFORMATION
            =============================================== */}

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


            {/* ===============================================
                DEPARTMENTS
            =============================================== */}

            <DepartmentChecklist
              departments={departments.map(
                ({
                  id,
                  nameAr,
                }) => ({
                  id,
                  nameAr,
                })
              )}
            />


            {/* ===============================================
                INTERNAL REGISTRATION FORM BUILDER
            =============================================== */}

            <ActivityFormBuilder />


            {/* ===============================================
                SAVE BUTTON
            =============================================== */}

            <button
              className="primary-btn"
              type="submit"
            >
              حفظ النشاط ونموذج التسجيل
            </button>

          </form>

        </div>


        {/* ===================================================
            CURRENT ACTIVITIES
        =================================================== */}

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
                          .nameAr
                    );

                  const isGeneral =
                    departmentNames.length ===
                    0 ||
                    departmentNames.length ===
                    departments.length;

                  const form =
                    activity.registrationForm;

                  return (
                    <article
                      className="data-row activity-admin-row"
                      key={activity.id}
                    >

                      <div>

                        <strong>
                          {activity.title}
                        </strong>


                        <div className="data-row-meta">

                          <span>
                            {isGeneral
                              ? "عام · جميع الأقسام"
                              : departmentNames.join(
                                "، "
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
                              }
                            ).format(
                              activity.startsAt
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


                        {/* ===================================
                            INTERNAL FORM INFO
                        =================================== */}

                        <div className="activity-admin-form-meta">

                          {form ? (
                            <>
                              <span>
                                نموذج داخلي
                              </span>

                              <span>
                                {
                                  form._count
                                    .questions
                                }{" "}
                                سؤال
                              </span>

                              <span>
                                {
                                  form._count
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
                              لا يوجد نموذج
                              تسجيل داخلي
                            </span>
                          )}

                        </div>

                      </div>


                      <div className="activity-admin-row-actions">

                        {activity.registrationForm && (
                          <Link
                            href={`/admin/activities/${activity.id}/registrations`}
                            className="ghost-btn"
                          >
                            إدارة المسجلين
                          </Link>
                        )}

                        <DeleteActivityForm
                          id={activity.id}
                          title={activity.title}
                        />

                      </div>

                    </article>
                  );
                }
              )
            ) : (
              <p className="empty-state">
                لا توجد أنشطة مضافة بعد.
              </p>
            )}

          </div>

        </div>

      </div>

    </section>
  );
}