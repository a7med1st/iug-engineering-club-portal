import { prisma } from "@/lib/prisma";
import AdminFeedback from "@/components/admin/AdminFeedback";
import { addStructureItem } from "../actions";

export const dynamic = "force-dynamic";

export default async function StructureAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const feedback = await searchParams;
  const [departments, items] = await Promise.all([
    prisma.department.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.clubStructureItem.findMany({
      include: { department: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <section className="admin-page">
      <div className="admin-page-head">
        <div>
          <h1>إضافة عنصر إلى الهيكلية</h1>
          <p className="muted">أضف الاسم والمنصب والقسم فقط لتحديث الهيكلية العامة للنادي.</p>
        </div>
      </div>

      <AdminFeedback error={feedback.error} success={feedback.success} />

      <div className="admin-content-grid">
        <div className="admin-card">
          <h2>بيانات عنصر الهيكلية</h2>
          <form action={addStructureItem} className="stack-form">
            <label>
              اسم الشخص
              <input name="name" required />
            </label>
            <label>
              المنصب
              <input name="title" required placeholder="رئيس النادي / مندوب القسم" />
            </label>
            <label>
              القسم
              <select name="departmentId" defaultValue="">
                <option value="">بدون قسم</option>
                {departments.map((department) => (
                  <option value={department.id} key={department.id}>{department.nameAr}</option>
                ))}
              </select>
            </label>
            <button className="primary-btn" type="submit">إضافة إلى الهيكلية</button>
          </form>
        </div>

        <div className="admin-card admin-list-card">
          <h2>عناصر الهيكلية الحالية</h2>
          <div className="data-list">
            {items.length ? items.map((item) => (
              <article className="data-row" key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <div className="data-row-meta">
                    <span>{item.title}</span>
                    <span>{item.department?.nameAr ?? "بدون قسم"}</span>
                  </div>
                </div>
              </article>
            )) : <p className="empty-state">لم تتم إضافة عناصر إلى الهيكلية بعد.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
