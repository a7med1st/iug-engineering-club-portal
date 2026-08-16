import AdminFeedback from "@/components/admin/AdminFeedback";

import {
  PERMISSIONS,
  requirePermission,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

import {
  addStructureMember,
  deleteStructureMember,
  updateStructureMember,
} from "./actions";

export const dynamic = "force-dynamic";

function nodeLabel(item: {
  name: string;
  title: string;
}) {
  return `${item.name} — ${item.title}`;
}

export default async function StructureAdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
}) {
  const { user } = await requirePermission(
    PERMISSIONS.STRUCTURE_MANAGE,
  );

  const feedback = await searchParams;
  const isAdmin = user.role === "ADMIN";

  const [items, accounts] = await Promise.all([
    prisma.clubStructureItem.findMany({
      where: isAdmin
        ? undefined
        : {
            departmentId:
              user.departmentId ??
              "__NO_DEPARTMENT__",
          },
      include: {
        department: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        parent: {
          select: {
            id: true,
            name: true,
            title: true,
          },
        },
        _count: {
          select: {
            children: true,
          },
        },
      },
      orderBy: [
        { level: "asc" },
        { sortOrder: "asc" },
        { createdAt: "asc" },
      ],
    }),

    prisma.user.findMany({
      where: {
        role: {
          in: isAdmin
            ? ["MEMBER", "ADMIN"]
            : ["MEMBER"],
        },
        ...(isAdmin
          ? {}
          : {
              departmentId:
                user.departmentId ??
                "__NO_DEPARTMENT__",
            }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        departmentId: true,
        department: {
          select: {
            nameAr: true,
          },
        },
        structureItem: {
          select: {
            id: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    }),
  ]);

  const availableAccounts = accounts.filter(
    (account) => !account.structureItem,
  );

  return (
    <section className="admin-page">
      <div className="admin-page-head">
        <div>
          <h1>الهيكلية التنظيمية</h1>
          <p className="muted">
            {isAdmin
              ? "اربط حسابات الأعضاء داخل شجرة تنظيمية تبدأ من رئيس النادي وتنتهي بأعضاء الأقسام."
              : `يمكنك إدارة أعضاء ${user.department?.nameAr ?? "قسمك"} فقط وربطهم بعناصر القسم.`}
          </p>
        </div>
      </div>

      <AdminFeedback
        error={feedback.error}
        success={feedback.success}
      />

      <div className="admin-content-grid">
        <div className="admin-card">
          <h2>إضافة عضو إلى الهيكلية</h2>

          <form
            action={addStructureMember}
            className="stack-form"
          >
            <label>
              حساب العضو
              <select
                name="userId"
                defaultValue=""
                required
              >
                <option value="" disabled>
                  اختر حسابًا
                </option>

                {availableAccounts.map(
                  (account) => (
                    <option
                      value={account.id}
                      key={account.id}
                    >
                      {account.name}
                      {" — "}
                      {account.department?.nameAr ??
                        (account.role === "ADMIN"
                          ? "الإدارة"
                          : "بدون قسم")}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label>
              المسمى داخل الهيكلية
              <input
                name="title"
                required
                list="structure-titles"
                placeholder="مثال: رئيس النادي / نائب الرئيس / مندوب القسم / عضو"
              />
            </label>

            <datalist id="structure-titles">
              <option value="رئيس النادي" />
              <option value="نائب رئيس النادي" />
              <option value="العلاقات العامة" />
              <option value="مندوب القسم" />
              <option value="عضو" />
            </datalist>

            <label>
              يتبع إلى
              <select
                name="parentId"
                defaultValue=""
              >
                <option value="">
                  {isAdmin
                    ? "بدون مسؤول أعلى — عنصر رئيسي"
                    : "اختر المسؤول الأعلى"}
                </option>

                {items.map((item) => (
                  <option
                    value={item.id}
                    key={item.id}
                  >
                    {nodeLabel(item)}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              className="primary-btn"
              disabled={
                !availableAccounts.length ||
                (!isAdmin && !user.departmentId)
              }
            >
              إضافة إلى الشجرة
            </button>

            {!availableAccounts.length && (
              <p className="muted">
                جميع الحسابات المتاحة ضمن نطاقك موجودة بالفعل في الهيكلية.
              </p>
            )}
          </form>
        </div>

        <div className="admin-card admin-list-card">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <h2>أعضاء الهيكلية</h2>
            <span className="muted">
              {items.length} عنصر
            </span>
          </div>

          <div className="data-list">
            {items.length ? (
              items.map((item) => (
                <article
                  className="data-row"
                  key={item.id}
                  style={{
                    alignItems: "flex-start",
                    gap: "18px",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <strong>
                      {item.user?.name ??
                        item.name}
                    </strong>

                    <div className="data-row-meta">
                      <span>{item.title}</span>
                      <span>
                        {item.department?.nameAr ??
                          "إدارة عامة"}
                      </span>
                      <span>
                        المستوى {item.level}
                      </span>
                      <span>
                        يتبعه {item._count.children} عنصر
                      </span>
                    </div>

                    <small className="muted">
                      المسؤول الأعلى:{" "}
                      {item.parent
                        ? nodeLabel(item.parent)
                        : "لا يوجد"}
                    </small>
                  </div>

                  <details style={{ minWidth: "260px" }}>
                    <summary
                      className="ghost-btn"
                      style={{
                        cursor: "pointer",
                        listStyle: "none",
                        textAlign: "center",
                      }}
                    >
                      تعديل
                    </summary>

                    <form
                      action={updateStructureMember}
                      className="stack-form"
                      style={{ marginTop: "14px" }}
                    >
                      <input
                        type="hidden"
                        name="itemId"
                        value={item.id}
                      />

                      <label>
                        الحساب
                        <select
                          name="userId"
                          defaultValue={
                            item.userId ?? ""
                          }
                          required
                        >
                          <option value="" disabled>
                            اختر الحساب
                          </option>

                          {accounts
                            .filter(
                              (account) =>
                                !account.structureItem ||
                                account.structureItem.id ===
                                  item.id,
                            )
                            .map((account) => (
                              <option
                                key={account.id}
                                value={account.id}
                              >
                                {account.name}
                              </option>
                            ))}
                        </select>
                      </label>

                      <label>
                        المسمى
                        <input
                          name="title"
                          defaultValue={item.title}
                          required
                          list="structure-titles"
                        />
                      </label>

                      <label>
                        المسؤول الأعلى
                        <select
                          name="parentId"
                          defaultValue={
                            item.parentId ?? ""
                          }
                        >
                          <option value="">
                            بدون مسؤول أعلى
                          </option>

                          {items
                            .filter(
                              (candidate) =>
                                candidate.id !==
                                item.id,
                            )
                            .map((candidate) => (
                              <option
                                value={candidate.id}
                                key={candidate.id}
                              >
                                {nodeLabel(candidate)}
                              </option>
                            ))}
                        </select>
                      </label>

                      <button
                        type="submit"
                        className="primary-btn"
                      >
                        حفظ التعديل
                      </button>
                    </form>

                    <form
                      action={deleteStructureMember}
                      style={{ marginTop: "8px" }}
                    >
                      <input
                        type="hidden"
                        name="itemId"
                        value={item.id}
                      />

                      <button
                        type="submit"
                        className="ghost-btn"
                        disabled={
                          item._count.children > 0
                        }
                        style={{ width: "100%" }}
                      >
                        حذف من الهيكلية
                      </button>
                    </form>
                  </details>
                </article>
              ))
            ) : (
              <p className="empty-state">
                لا توجد عناصر في الهيكلية حتى الآن.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
