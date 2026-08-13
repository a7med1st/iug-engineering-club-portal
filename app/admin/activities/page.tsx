import DepartmentChecklist from "@/components/admin/DepartmentChecklist";
import AdminFeedback from "@/components/admin/AdminFeedback";
import DeleteActivityForm from "@/components/admin/DeleteActivityForm";
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
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const feedback = await searchParams;
  const [departments, activities] = await Promise.all([
    prisma.department.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.activity.findMany({
      include: { departments: { include: { department: true } } },
      orderBy: { startsAt: "desc" },
    }),
  ]);

  return (
    <section className="admin-page">
      <div className="admin-page-head">
        <div>
          <h1>إضافة نشاط</h1>
          <p className="muted">أنشئ النشاط وحدد قسمًا واحدًا أو عدة أقسام، أو اجعله عامًا لجميع الطلبة.</p>
        </div>
      </div>

      <AdminFeedback error={feedback.error} success={feedback.success} />

      <div className="admin-content-grid">
        <div className="admin-card">
          <h2>بيانات النشاط</h2>
          <form action={createActivity} className="stack-form">
            <label>
              اسم النشاط
              <input name="title" required />
            </label>
            <label>
              وصف مختصر للنشاط
              <textarea name="description" required />
            </label>
            <div className="form-grid">
              <label>
                تاريخ ووقت النشاط
                <input type="datetime-local" name="startsAt" required />
              </label>
              <label>
                مكان النشاط
                <input name="location" required />
              </label>
              <label>
                السعة الطلابية
                <input type="number" min="1" name="capacity" required />
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
            <label>
              رابط التسجيل
              <input type="url" name="formUrl" required placeholder="https://..." dir="ltr" />
            </label>
            <DepartmentChecklist departments={departments.map(({ id, nameAr }) => ({ id, nameAr }))} />
            <button className="primary-btn" type="submit">حفظ النشاط</button>
          </form>
        </div>

        <div className="admin-card admin-list-card">
          <h2>الأنشطة الحالية</h2>
          <div className="data-list">
            {activities.length ? activities.map((activity) => {
              const departmentNames = activity.departments.map((link) => link.department.nameAr);
              const isGeneral = departmentNames.length === 0 || departmentNames.length === departments.length;
              return (
                <article className="data-row activity-admin-row" key={activity.id}>
                  <div>
                    <strong>{activity.title}</strong>
                    <div className="data-row-meta">
                      <span>{isGeneral ? "عام · جميع الأقسام" : departmentNames.join("، ")}</span>
                      <span>{new Intl.DateTimeFormat("ar-PS", { dateStyle: "medium", timeStyle: "short" }).format(activity.startsAt)}</span>
                      <span>{statusLabels[activity.status]}</span>
                    </div>
                  </div>
                  <DeleteActivityForm id={activity.id} title={activity.title} />
                </article>
              );
            }) : <p className="empty-state">لا توجد أنشطة مضافة بعد.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
