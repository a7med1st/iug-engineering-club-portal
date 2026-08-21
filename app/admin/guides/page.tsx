import DepartmentGuideEditor from "@/components/admin/DepartmentGuideEditor";
import AdminFeedback from "@/components/admin/AdminFeedback";

import {
  PERMISSIONS,
  requirePermission,
} from "@/lib/permissions";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function GuidesAdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
}) {
  const { user } = await requirePermission(PERMISSIONS.GUIDE_MANAGE);
  const feedback = await searchParams;

  const departments = await prisma.department.findMany({
    where:
      user.role === "MEMBER"
        ? {
            id: user.departmentId ?? "__NO_DEPARTMENT__",
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
    <section className="admin-page guide-admin-page">
      <div className="admin-page-head guide-admin-head">
        <div>
          <h1>تحرير دليل قسم</h1>
          <p className="muted">
            {user.role === "ADMIN"
              ? "اختر أحد أقسام الهندسة، ثم حدّث محتوى دليله واحفظ التغييرات."
              : `يمكنك تعديل دليل ${
                  user.department?.nameAr ?? "القسم المرتبط بحسابك"
                } فقط.`}
          </p>
        </div>
      </div>

      <AdminFeedback error={feedback.error} success={feedback.success} />

      <div className="admin-card guide-editor-card guide-editor-shell">
        <div className="guide-shell-decoration" aria-hidden="true" />

        {departments.length ? (
          <DepartmentGuideEditor departments={departments} />
        ) : (
          <p className="empty-state">لا يوجد قسم مرتبط بحسابك.</p>
        )}
      </div>

      <style>{`
        .guide-admin-page .guide-editor-shell {
          position: relative;
          isolation: isolate;
          overflow: visible;
          border: 1px solid rgba(176, 204, 232, .78);
          background:
            radial-gradient(circle at 92% 2%, rgba(22,136,255,.14), transparent 28%),
            radial-gradient(circle at 6% 100%, rgba(53,212,255,.10), transparent 30%),
            linear-gradient(180deg, #ffffff 0%, #f6fbff 100%);
          box-shadow:
            0 24px 60px rgba(6, 24, 44, .085),
            inset 0 1px 0 rgba(255,255,255,.94);
        }

        .guide-admin-page .guide-editor-shell::after {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -2;
          pointer-events: none;
          border-radius: inherit;
          background-image:
            linear-gradient(rgba(22,136,255,.026) 1px, transparent 1px),
            linear-gradient(90deg, rgba(22,136,255,.026) 1px, transparent 1px);
          background-size: 28px 28px;
          mask-image: linear-gradient(to bottom, black, transparent 70%);
        }

        .guide-admin-page .guide-shell-decoration {
          position: absolute;
          top: 0;
          left: 0;
          width: 170px;
          height: 170px;
          overflow: hidden;
          border-radius: 18px 0 0 0;
          pointer-events: none;
          z-index: -1;
        }

        .guide-admin-page .guide-shell-decoration::before {
          content: "";
          position: absolute;
          top: -78px;
          left: -60px;
          width: 185px;
          height: 185px;
          border: 28px solid rgba(22,136,255,.05);
          border-radius: 50%;
        }

        .guide-admin-page .guide-editor-shell > *:not(.guide-shell-decoration) {
          position: relative;
          z-index: 1;
        }
      `}</style>
    </section>
  );
}