import AdminFeedback from "@/components/admin/AdminFeedback";

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

export const dynamic =
  "force-dynamic";

const formatCreatedAt = (
  date: Date,
) =>
  new Intl.DateTimeFormat(
    "ar-PS",
    {
      dateStyle: "medium",
    },
  ).format(date);

const permissionLabelMap =
  new Map<string, string>(
    MEMBER_PERMISSION_OPTIONS.map(
      (item) => [
        item.permission,
        item.label,
      ],
    ),
  );

export default async function MembersAdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
}) {
  await requirePermission(
    PERMISSIONS.MEMBER_MANAGE,
  );

  const feedback =
    await searchParams;

  const [
    departments,
    members,
  ] =
    await Promise.all([
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
    <section className="admin-page">
      <div className="admin-page-head">
        <div>
          <h1>
            إدارة حسابات الأعضاء
          </h1>

          <p className="muted">
            أنشئ حساب عضو، اربطه
            بقسمه، ثم حدد صلاحياته
            بدقة. الصلاحيات المرتبطة
            بقسم ستعمل فقط داخل قسم
            العضو.
          </p>
        </div>
      </div>

      <AdminFeedback
        error={feedback.error}
        success={feedback.success}
      />

      {/* =================================================
          CREATE MEMBER
      ================================================= */}

      <div className="admin-card admin-form-card">
        <h2>
          عضو جديد
        </h2>

        <form
          action={createMember}
          className="stack-form"
        >
          <div className="form-grid">
            <label>
              الاسم
              <input
                name="name"
                required
                autoComplete="name"
              />
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

            <label>
              القسم المسؤول عنه
              <select
                name="departmentId"
                defaultValue=""
              >
                <option value="">
                  بدون قسم
                </option>

                {departments.map(
                  (department) => (
                    <option
                      key={
                        department.id
                      }
                      value={
                        department.id
                      }
                    >
                      {
                        department.nameAr
                      }
                    </option>
                  ),
                )}
              </select>
            </label>

            <label>
              الدور
              <input
                value="عضو (MEMBER)"
                disabled
              />

              <input
                type="hidden"
                name="role"
                value="MEMBER"
              />
            </label>
          </div>

          <fieldset>
            <legend>
              الصلاحيات
            </legend>

            <p className="muted">
              الصلاحيات المكتوب عليها
              "ضمن القسم" لا تمنح العضو
              وصولًا إلى أي قسم آخر.
            </p>

            <div className="data-list">
              {MEMBER_PERMISSION_OPTIONS.map(
                (item) => (
                  <label
                    key={
                      item.permission
                    }
                    className="data-row"
                  >
                    <span>
                      <input
                        type="checkbox"
                        name="permissions"
                        value={
                          item.permission
                        }
                      />{" "}
                      {item.label}
                    </span>

                    <small className="muted">
                      {item.scope ===
                      "DEPARTMENT"
                        ? "ضمن القسم"
                        : "صلاحية عامة"}
                    </small>
                  </label>
                ),
              )}
            </div>
          </fieldset>

          <button
            className="primary-btn"
            type="submit"
          >
            إنشاء حساب العضو
          </button>
        </form>
      </div>

      {/* =================================================
          MEMBERS
      ================================================= */}

      <div className="admin-card members-list-card">
        <div className="admin-card-head">
          <h2>
            الأعضاء الموجودون
          </h2>

          <span className="count-badge">
            {members.length} عضو
          </span>
        </div>

        {members.length ? (
          <div className="data-list">
            {members.map(
              (member) => {
                const labels =
                  member.memberPermissions
                    .map(
                      (permission) =>
                        permissionLabelMap.get(
                          permission,
                        ),
                    )
                    .filter(
                      (
                        label,
                      ): label is string =>
                        Boolean(
                          label,
                        ),
                    );

                return (
                  <article
                    className="data-row"
                    key={
                      member.id
                    }
                  >
                    <div
                      style={{
                        width:
                          "100%",
                      }}
                    >
                      <strong>
                        {
                          member.name
                        }
                      </strong>

                      <div className="data-row-meta">
                        <span>
                          {member.position ||
                            "عضو"}
                        </span>

                        <span>
                          {member.department
                            ?.nameAr ??
                            "بدون قسم"}
                        </span>

                        <span dir="ltr">
                          {
                            member.email
                          }
                        </span>

                        <span>
                          أضيف في{" "}
                          {formatCreatedAt(
                            member.createdAt,
                          )}
                        </span>
                      </div>

                      <p className="muted">
                        {labels.length
                          ? labels.join(
                              " · ",
                            )
                          : "لا توجد صلاحيات إضافية"}
                      </p>

                      <details>
                        <summary>
                          تعديل القسم
                          والصلاحيات
                        </summary>

                        <form
                          action={
                            updateMemberAccess
                          }
                          className="stack-form"
                          style={{
                            marginTop:
                              "16px",
                          }}
                        >
                          <input
                            type="hidden"
                            name="memberId"
                            value={
                              member.id
                            }
                          />

                          <div className="form-grid">
                            <label>
                              المسمى داخل
                              النادي
                              <input
                                name="position"
                                defaultValue={
                                  member.position ??
                                  ""
                                }
                              />
                            </label>

                            <label>
                              القسم المسؤول
                              عنه
                              <select
                                name="departmentId"
                                defaultValue={
                                  member.departmentId ??
                                  ""
                                }
                              >
                                <option value="">
                                  بدون قسم
                                </option>

                                {departments.map(
                                  (
                                    department,
                                  ) => (
                                    <option
                                      key={
                                        department.id
                                      }
                                      value={
                                        department.id
                                      }
                                    >
                                      {
                                        department.nameAr
                                      }
                                    </option>
                                  ),
                                )}
                              </select>
                            </label>
                          </div>

                          <fieldset>
                            <legend>
                              صلاحيات العضو
                            </legend>

                            <div className="data-list">
                              {MEMBER_PERMISSION_OPTIONS.map(
                                (
                                  item,
                                ) => (
                                  <label
                                    key={
                                      item.permission
                                    }
                                    className="data-row"
                                  >
                                    <span>
                                      <input
                                        type="checkbox"
                                        name="permissions"
                                        value={
                                          item.permission
                                        }
                                        defaultChecked={member.memberPermissions.includes(
                                          item.permission,
                                        )}
                                      />{" "}
                                      {
                                        item.label
                                      }
                                    </span>

                                    <small className="muted">
                                      {item.scope ===
                                      "DEPARTMENT"
                                        ? "ضمن القسم"
                                        : "صلاحية عامة"}
                                    </small>
                                  </label>
                                ),
                              )}
                            </div>
                          </fieldset>

                          <button
                            type="submit"
                            className="primary-btn"
                          >
                            حفظ الصلاحيات
                          </button>
                        </form>
                      </details>
                    </div>
                  </article>
                );
              },
            )}
          </div>
        ) : (
          <p className="empty-state">
            لا توجد حسابات أعضاء حتى
            الآن.
          </p>
        )}
      </div>
    </section>
  );
}