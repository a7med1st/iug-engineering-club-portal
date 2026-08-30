import AdminFeedback from "@/components/admin/AdminFeedback";
import StructureSelect from "@/components/admin/StructureSelect";
import { NonceStyle } from "@/components/security/CspNonce";

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
    <section className="admin-page structure-admin-page">
      <div className="admin-page-head structure-page-head">
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

      <div className="admin-content-grid structure-content-grid">
        <div className="admin-card structure-panel structure-form-panel">
          <div className="structure-panel-decoration" aria-hidden="true" />

          <div className="structure-panel-head">
            <div>
              <h2>إضافة عضو إلى الهيكلية</h2>
              <p>اختر الحساب وحدد المسمى والمسؤول الأعلى داخل الشجرة.</p>
            </div>
          </div>

          <form
            action={addStructureMember}
            className="stack-form structure-form"
          >
            <label>
              حساب العضو
              <StructureSelect
                name="userId"
                required
                kind="account"
                placeholder="اختر حسابًا"
                options={availableAccounts.map((account) => ({
                  value: account.id,
                  label: account.name,
                  hint:
                    account.department?.nameAr ??
                    (account.role === "ADMIN" ? "الإدارة" : "بدون قسم"),
                }))}
              />
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
              <StructureSelect
                name="parentId"
                kind="parent"
                allowEmpty
                placeholder="اختر المسؤول الأعلى"
                emptyLabel={isAdmin ? "بدون مسؤول أعلى" : "اختر المسؤول الأعلى"}
                emptyHint={isAdmin ? "عنصر رئيسي في الهيكلية" : undefined}
                options={items.map((item) => ({
                  value: item.id,
                  label: item.name,
                  hint: item.title,
                }))}
              />
            </label>

            <button
              type="submit"
              className="primary-btn structure-primary-btn"
              disabled={
                !availableAccounts.length ||
                (!isAdmin && !user.departmentId)
              }
            >
              <span>إضافة إلى الشجرة</span>
              <span className="structure-btn-arrow" aria-hidden="true">↗</span>
            </button>

            {!availableAccounts.length && (
              <p className="muted structure-form-note">
                جميع الحسابات المتاحة ضمن نطاقك موجودة بالفعل في الهيكلية.
              </p>
            )}
          </form>
        </div>

        <div className="admin-card admin-list-card structure-panel structure-list-panel">
          <div className="structure-panel-decoration" aria-hidden="true" />

          <div className="structure-panel-head structure-list-head">
            <div>
              <h2>أعضاء الهيكلية</h2>
              <p>راجع العناصر الحالية وعدّل ارتباطاتها داخل الهيكلية.</p>
            </div>

            <span className="structure-count-badge">
              <strong>{items.length}</strong>
              <span>عنصر</span>
            </span>
          </div>

          <div className="data-list structure-member-list">
            {items.length ? (
              items.map((item) => (
                <article
                  className="data-row structure-member-card"
                  key={item.id}
                >
                  <div className="structure-member-accent" aria-hidden="true" />

                  <div className="structure-member-main">
                    <div className="structure-member-title-row">
                      <div>
                        <strong className="structure-member-name">
                          {item.user?.name ?? item.name}
                        </strong>
                        <span className="structure-member-role">
                          {item.title}
                        </span>
                      </div>
                    </div>

                    <div className="structure-member-meta">
                      <span>{item.department?.nameAr ?? "إدارة عامة"}</span>
                      <span>المستوى {item.level}</span>
                      <span>يتبعه {item._count.children} عنصر</span>
                    </div>

                    <div className="structure-parent-line">
                      <span className="structure-parent-label">المسؤول الأعلى</span>
                      <span className="structure-parent-value">
                        {item.parent
                          ? nodeLabel(item.parent)
                          : "لا يوجد"}
                      </span>
                    </div>

                    <details className="structure-member-editor">
                    <summary className="ghost-btn structure-edit-trigger">
                      <span>تعديل بيانات العضو</span>
                      <span className="structure-edit-chevron" aria-hidden="true">⌄</span>
                    </summary>

                    <div className="structure-edit-content">
                      <form
                        action={updateStructureMember}
                        className="stack-form structure-edit-form"
                      >
                        <input
                          type="hidden"
                          name="itemId"
                          value={item.id}
                        />

                        <label>
                          الحساب
                          <StructureSelect
                            name="userId"
                            required
                            kind="account"
                            defaultValue={item.userId ?? ""}
                            placeholder="اختر الحساب"
                            options={accounts
                              .filter(
                                (account) =>
                                  !account.structureItem ||
                                  account.structureItem.id === item.id,
                              )
                              .map((account) => ({
                                value: account.id,
                                label: account.name,
                                hint:
                                  account.department?.nameAr ??
                                  (account.role === "ADMIN" ? "الإدارة" : "بدون قسم"),
                              }))}
                          />
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
                          <StructureSelect
                            name="parentId"
                            kind="parent"
                            allowEmpty
                            defaultValue={item.parentId ?? ""}
                            placeholder="اختر المسؤول الأعلى"
                            emptyLabel="بدون مسؤول أعلى"
                            emptyHint="عنصر رئيسي في الهيكلية"
                            options={items
                              .filter((candidate) => candidate.id !== item.id)
                              .map((candidate) => ({
                                value: candidate.id,
                                label: candidate.name,
                                hint: candidate.title,
                              }))}
                          />
                        </label>

                        <button
                          type="submit"
                          className="primary-btn structure-save-btn"
                        >
                          حفظ التعديل
                        </button>
                      </form>

                      <form
                        action={deleteStructureMember}
                        className="structure-delete-form"
                      >
                        <input
                          type="hidden"
                          name="itemId"
                          value={item.id}
                        />
                        <button
                          type="submit"
                          className="ghost-btn structure-delete-btn"
                          disabled={item._count.children > 0}
                        >
                          حذف من الهيكلية
                        </button>
                      </form>
                    </div>
                    </details>
                  </div>
                </article>
              ))
            ) : (
              <div className="structure-empty-state">
                <span className="structure-empty-icon" aria-hidden="true">✦</span>
                <strong>لا توجد عناصر في الهيكلية</strong>
                <p>أضف أول عضو من النموذج ليظهر هنا.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <NonceStyle>{`
        .structure-admin-page {
          --structure-blue: #1688ff;
          --structure-cyan: #35d4ff;
          --structure-navy: #0a2340;
        }

        .structure-admin-page .structure-page-head {
          margin-bottom: 24px;
        }

        .structure-admin-page .structure-content-grid {
          gap: 18px;
        }

        /* Keep dropdown menus free from card clipping */
        .structure-admin-page .structure-panel {
          position: relative;
          isolation: isolate;
          overflow: visible;
          border: 1px solid rgba(179, 204, 232, .76);
          background:
            linear-gradient(180deg, rgba(255,255,255,.98), rgba(247,251,255,.98));
          box-shadow:
            0 18px 45px rgba(6, 24, 44, .07),
            inset 0 1px 0 rgba(255,255,255,.96);
        }

        .structure-admin-page .structure-form-panel,
        .structure-admin-page .structure-list-panel {
          position: relative;
          background:
            radial-gradient(circle at 92% 8%, rgba(22, 136, 255, .14), transparent 28%),
            radial-gradient(circle at 8% 94%, rgba(53, 212, 255, .11), transparent 30%),
            linear-gradient(180deg, rgba(255,255,255,.99) 0%, rgba(246,251,255,.98) 58%, rgba(239,248,255,.98) 100%);
          box-shadow:
            0 22px 52px rgba(6, 24, 44, .09),
            inset 0 1px 0 rgba(255,255,255,.98);
        }

        .structure-admin-page .structure-form-panel::after,
        .structure-admin-page .structure-list-panel::after {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -2;
          pointer-events: none;
          border-radius: inherit;
          background-image:
            linear-gradient(rgba(22,136,255,.028) 1px, transparent 1px),
            linear-gradient(90deg, rgba(22,136,255,.028) 1px, transparent 1px);
          background-size: 28px 28px;
          mask-image: linear-gradient(to bottom, black, transparent 72%);
        }

        /* Decorative circle is clipped INSIDE each panel only.
           The panel itself stays overflow: visible so custom dropdowns are not cut off. */
        .structure-admin-page .structure-panel-decoration {
          display: block;
          position: absolute;
          inset: 0;
          z-index: -1;
          overflow: hidden;
          border-radius: inherit;
          pointer-events: none;
        }

        .structure-admin-page .structure-panel-decoration::before {
          content: "";
          position: absolute;
          top: -72px;
          left: -56px;
          width: 170px;
          height: 170px;
          border: 24px solid rgba(22,136,255,.045);
          border-radius: 50%;
        }

        .structure-admin-page .structure-panel-head {
          margin-bottom: 17px;
          padding-bottom: 14px;
          border-bottom: 1px solid #dfe9f2;
        }

        .structure-admin-page .structure-panel-head h2 {
          margin: 0;
          color: #0d2746;
          font-size: 1.02rem;
        }

        .structure-admin-page .structure-panel-head p {
          margin: 6px 0 0;
          color: #74869a;
          font-size: .72rem;
        }

        .structure-admin-page .structure-list-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }

        .structure-admin-page .structure-count-badge {
          flex: 0 0 auto;
          min-width: 60px;
          padding: 8px 11px;
          display: grid;
          justify-items: center;
          border: 1px solid #d6e6f4;
          border-radius: 14px;
          background: #f8fbff;
          color: #738398;
          font-family: "Alexandria", sans-serif;
          font-size: .61rem;
        }

        .structure-admin-page .structure-count-badge strong {
          color: var(--structure-blue);
          font-size: 1rem;
          line-height: 1.2;
        }

        .structure-admin-page .structure-form,
        .structure-admin-page .structure-edit-form {
          position: relative;
          z-index: 2;
        }

        .structure-admin-page .structure-form label,
        .structure-admin-page .structure-edit-form label {
          min-width: 0;
          color: #193450;
          font-family: "Alexandria", sans-serif;
          font-size: .72rem;
          font-weight: 700;
        }

        .structure-admin-page .structure-form input,
        .structure-admin-page .structure-edit-form input {
          width: 100%;
          min-width: 0;
          min-height: 46px;
          border: 1px solid #cbdbea;
          border-radius: 12px;
          background: rgba(255,255,255,.94);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.96);
          transition: border-color .2s ease, box-shadow .2s ease, background .2s ease;
        }

        .structure-admin-page .structure-form input:hover,
        .structure-admin-page .structure-edit-form input:hover {
          border-color: #96c4ed;
          background: #fff;
        }

        .structure-admin-page .structure-form input:focus,
        .structure-admin-page .structure-edit-form input:focus {
          border-color: var(--structure-blue);
          background: #fff;
          box-shadow: 0 0 0 3px rgba(22,136,255,.09);
          outline: none;
        }

        .structure-admin-page .structure-primary-btn,
        .structure-admin-page .structure-save-btn {
          border: 0;
          background: linear-gradient(115deg, #0f73e7 0%, #1688ff 50%, #35c9f4 100%);
          box-shadow: 0 11px 25px rgba(22,136,255,.20);
          transition: transform .2s ease, box-shadow .2s ease, filter .2s ease;
        }

        .structure-admin-page .structure-primary-btn:hover,
        .structure-admin-page .structure-save-btn:hover {
          transform: translateY(-2px);
          filter: saturate(1.07);
          box-shadow: 0 15px 30px rgba(22,136,255,.26);
        }

        .structure-admin-page .structure-btn-arrow {
          transition: transform .2s ease;
        }

        .structure-admin-page .structure-primary-btn:hover .structure-btn-arrow {
          transform: translate(-2px, -2px);
        }

        .structure-admin-page .structure-form-note {
          padding: 10px 12px;
          border: 1px solid #d9e5ef;
          border-radius: 11px;
          background: #f8fbfe;
          text-align: center;
          font-size: .7rem;
        }

        .structure-admin-page .structure-member-list {
          gap: 13px;
          margin-top: 0;
        }

        /* Member card: block layout prevents the editor from getting squeezed */
        .structure-admin-page .structure-member-card {
          position: relative;
          display: block;
          width: 100%;
          min-width: 0;
          overflow: visible;
          padding: 17px 18px 18px;
          border: 1px solid #cfdeeb;
          border-radius: 16px;
          background: #fff;
          box-shadow: 0 8px 20px rgba(7,37,68,.045);
          transition: border-color .2s ease, box-shadow .2s ease, transform .2s ease;
        }

        .structure-admin-page .structure-member-card:hover {
          transform: translateY(-2px);
          border-color: #a8d1f2;
          box-shadow: 0 14px 28px rgba(7,47,87,.09);
        }

        .structure-admin-page .structure-member-accent {
          position: absolute;
          inset-block: 14px;
          inset-inline-start: 0;
          width: 4px;
          border-radius: 0 999px 999px 0;
          background: linear-gradient(180deg, var(--structure-blue), var(--structure-cyan));
        }

        .structure-admin-page .structure-member-main {
          width: 100%;
          min-width: 0;
        }

        .structure-admin-page .structure-member-name {
          display: block;
          color: #102c4d;
          font-size: .9rem;
        }

        .structure-admin-page .structure-member-role {
          display: inline-flex;
          margin-top: 4px;
          color: #5d738b;
          font-size: .69rem;
        }

        .structure-admin-page .structure-member-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 11px;
        }

        .structure-admin-page .structure-member-meta span {
          width: fit-content;
          padding: 5px 9px;
          border: 1px solid #d7e4f0;
          border-radius: 999px;
          background: #f6faff;
          color: #60758c;
          font-size: .63rem;
        }

        .structure-admin-page .structure-parent-line {
          margin-top: 11px;
          padding-top: 10px;
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 6px;
          border-top: 1px solid #e5edf4;
          color: #788a9d;
          font-size: .67rem;
        }

        .structure-admin-page .structure-parent-value {
          color: #365977;
          font-weight: 700;
        }

        /* Full-width edit drawer */
        .structure-admin-page .structure-member-editor {
          display: block;
          width: 100%;
          min-width: 0;
          margin-top: 13px;
        }

        .structure-admin-page .structure-edit-trigger {
          width: 100%;
          min-height: 42px;
          padding: 8px 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          list-style: none;
          border: 1px solid #d6e4f0;
          border-radius: 11px;
          background: #f8fbfe;
          color: #31516f;
          cursor: pointer;
          box-shadow: none;
          transition: border-color .2s ease, background .2s ease, color .2s ease;
        }

        .structure-admin-page .structure-edit-trigger::-webkit-details-marker {
          display: none;
        }

        .structure-admin-page .structure-edit-trigger:hover {
          border-color: #a9cff0;
          background: #f0f8ff;
          color: #0b72d3;
        }

        .structure-admin-page .structure-edit-chevron {
          width: 28px;
          height: 28px;
          display: grid;
          place-items: center;
          border-radius: 8px;
          background: #eaf5ff;
          color: var(--structure-blue);
          transition: transform .2s ease;
        }

        .structure-admin-page .structure-member-editor[open] .structure-edit-trigger {
          border-color: #a8d1f2;
          border-radius: 11px 11px 8px 8px;
          background: #eef7ff;
          color: #0b72d3;
        }

        .structure-admin-page .structure-member-editor[open] .structure-edit-chevron {
          transform: rotate(180deg);
        }

        .structure-admin-page .structure-edit-content {
          width: 100%;
          min-width: 0;
          margin-top: 8px;
          padding: 15px;
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
          border: 1px solid #d8e5f0;
          border-radius: 12px;
          background: #f8fbfe;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.95);
          animation: structureEditorIn .18s ease both;
        }

        .structure-admin-page .structure-edit-form {
          width: 100%;
          min-width: 0;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .structure-admin-page .structure-edit-form > label:nth-of-type(3) {
          grid-column: 1 / -1;
        }

        .structure-admin-page .structure-save-btn {
          grid-column: 1 / -1;
          width: 100%;
          min-height: 42px;
        }

        .structure-admin-page .structure-delete-form {
          width: 100%;
          margin: 0;
        }

        .structure-admin-page .structure-delete-btn {
          width: 100%;
          min-height: 40px;
          border: 1px solid #efcccc;
          border-radius: 10px;
          background: #fff6f6;
          color: #a83232;
          transition: border-color .2s ease, background .2s ease, color .2s ease;
        }

        .structure-admin-page .structure-delete-btn:hover:not(:disabled) {
          border-color: #e8aeae;
          background: #ffecec;
          color: #8e2020;
        }

        .structure-admin-page .structure-delete-btn:disabled {
          opacity: .48;
          cursor: not-allowed;
        }

        .structure-admin-page .structure-empty-state {
          min-height: 220px;
          padding: 28px 18px;
          display: grid;
          place-items: center;
          align-content: center;
          gap: 6px;
          border: 1px dashed #bfd7ec;
          border-radius: 16px;
          background: #fbfdff;
          text-align: center;
        }

        .structure-admin-page .structure-empty-icon {
          width: 46px;
          height: 46px;
          display: grid;
          place-items: center;
          border-radius: 13px;
          background: #edf7ff;
          color: var(--structure-blue);
          font-size: 1.1rem;
        }

        .structure-admin-page .structure-empty-state strong {
          color: #193652;
          font-family: "Alexandria", sans-serif;
          font-size: .84rem;
        }

        .structure-admin-page .structure-empty-state p {
          color: #75879a;
          font-size: .72rem;
        }

        @keyframes structureEditorIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 900px) {
          .structure-admin-page .structure-edit-form {
            grid-template-columns: 1fr;
          }

          .structure-admin-page .structure-edit-form > label:nth-of-type(3),
          .structure-admin-page .structure-save-btn {
            grid-column: auto;
          }
        }

        @media (max-width: 560px) {
          .structure-admin-page .structure-panel {
            padding: 16px;
          }

          .structure-admin-page .structure-list-head {
            align-items: flex-start;
            flex-direction: column;
          }

          .structure-admin-page .structure-count-badge {
            min-width: 0;
            display: inline-flex;
            align-items: baseline;
            gap: 5px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .structure-admin-page .structure-primary-btn,
          .structure-admin-page .structure-save-btn,
          .structure-admin-page .structure-member-card,
          .structure-admin-page .structure-edit-trigger {
            transition: none;
          }
        }
      `}</NonceStyle>
    </section>
  );
}
