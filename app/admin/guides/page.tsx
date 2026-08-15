import DepartmentGuideEditor from "@/components/admin/DepartmentGuideEditor";
import AdminFeedback from "@/components/admin/AdminFeedback";

import {
  PERMISSIONS,
  requirePermission,
} from "@/lib/permissions";

import { prisma } from "@/lib/prisma";

export const dynamic =
  "force-dynamic";

export default async function GuidesAdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
}) {
  const { user } =
    await requirePermission(
      PERMISSIONS.GUIDE_MANAGE,
    );

  const feedback =
    await searchParams;

  const departments =
    await prisma.department.findMany({
      where:
        user.role === "MEMBER"
          ? {
              id:
                user.departmentId ??
                "__NO_DEPARTMENT__",
            }
          : undefined,

      include: {
        guide: true,
      },

      orderBy: {
        sortOrder: "asc",
      },
    });

  return (
    <section className="admin-page">
      <div className="admin-page-head">
        <div>
          <h1>
            تحرير دليل قسم
          </h1>

          <p className="muted">
            {user.role === "ADMIN"
              ? "اختر أحد أقسام الهندسة، ثم حدّث محتوى دليله واحفظ التغييرات."
              : `يمكنك تعديل دليل ${
                  user.department
                    ?.nameAr ??
                  "القسم المرتبط بحسابك"
                } فقط.`}
          </p>
        </div>
      </div>

      <AdminFeedback
        error={feedback.error}
        success={feedback.success}
      />

      <div className="admin-card guide-editor-card">
        {departments.length ? (
          <DepartmentGuideEditor
            departments={
              departments
            }
          />
        ) : (
          <p className="empty-state">
            لا يوجد قسم مرتبط بحسابك.
          </p>
        )}
      </div>
    </section>
  );
}
