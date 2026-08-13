import DepartmentGuideEditor from "@/components/admin/DepartmentGuideEditor";
import AdminFeedback from "@/components/admin/AdminFeedback";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function GuidesAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const feedback = await searchParams;
  const departments = await prisma.department.findMany({
    include: { guide: true },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <section className="admin-page">
      <div className="admin-page-head">
        <div>
          <h1>تحرير دليل قسم</h1>
          <p className="muted">اختر أحد أقسام الهندسة، ثم حدّث محتوى دليله واحفظ التغييرات.</p>
        </div>
      </div>

      <AdminFeedback error={feedback.error} success={feedback.success} />

      <div className="admin-card guide-editor-card">
        <DepartmentGuideEditor departments={departments} />
      </div>
    </section>
  );
}
