import Link from "next/link";
import { restoreActivity } from "@/app/admin/actions";
import AdminFeedback from "@/components/admin/AdminFeedback";
import { formatActivityTimestamp } from "@/lib/activities";
import {
  PERMISSIONS,
  canAccessActivityDepartments,
  isClubLeadership,
  managedDepartmentIdsForUser,
  requirePermission,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ActivityTrashPage({ searchParams }: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { user } = await requirePermission(PERMISSIONS.ACTIVITY_MANAGE);
  const feedback = await searchParams;
  const isAdmin = user.role === "ADMIN" || isClubLeadership(user.position);
  const departmentIds = managedDepartmentIdsForUser(user);
  const rawActivities = await prisma.activity.findMany({
    where: {
      deletedAt: { not: null },
      ...(isAdmin ? {} : {
        departments: { some: { departmentId: { in: departmentIds } } },
      }),
    },
    include: {
      departments: { include: { department: { select: { nameAr: true } } } },
      registrationForm: { select: { _count: { select: { submissions: true } } } },
    },
    orderBy: { deletedAt: "desc" },
  });
  const activities = rawActivities.filter(activity => canAccessActivityDepartments(
    user, activity.departments.map(link => link.departmentId),
  ));

  return (
    <section className="admin-page">
      <div className="admin-page-head">
        <div>
          <h1>سلة محذوفات الأنشطة</h1>
          <p className="muted">استرجع النشاط مع صوره ونموذج التسجيل والمشتركين والحضور، وبنفس حالته قبل الحذف.</p>
        </div>
        <Link className="ghost-btn" href="/admin/activities">العودة إلى الأنشطة</Link>
      </div>
      <AdminFeedback error={feedback.error} success={feedback.success} />
      <div className="admin-card">
        <h2>الأنشطة المحذوفة ({activities.length})</h2>
        <p className="muted">تظهر هنا الأنشطة المحذوفة بعد تفعيل سلة المحذوفات. الحذف النهائي السابق لا يمكن استرجاعه من هنا.</p>
        <div className="data-list">
          {activities.length ? activities.map(activity => (
            <div className="data-row" key={activity.id}>
              <div>
                <h3>{activity.title}</h3>
                <p className="muted">حُذف في {formatActivityTimestamp(activity.deletedAt)}</p>
                <p className="muted">
                  {activity.departments.map(link => link.department.nameAr).join("، ") || "نشاط عام"}
                  {" · "}{activity.registrationForm?._count.submissions ?? 0} تسجيل
                </p>
              </div>
              <form action={restoreActivity}>
                <input type="hidden" name="id" value={activity.id} />
                <button className="primary-btn" type="submit">استرجاع النشاط</button>
              </form>
            </div>
          )) : <p className="muted">لا توجد أنشطة في سلة المحذوفات.</p>}
        </div>
      </div>
    </section>
  );
}
