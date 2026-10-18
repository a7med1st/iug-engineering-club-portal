import ActivityWizard from "@/components/admin/ActivityWizard";
import { PERMISSIONS, isClubLeadership, managedDepartmentIdsForUser, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function NewActivityPage() {
  const { user } = await requirePermission(PERMISSIONS.ACTIVITY_MANAGE);
  const isAdmin = user.role === "ADMIN" || isClubLeadership(user.position);
  const departments = await prisma.department.findMany({
    where: isAdmin ? {} : { id: { in: managedDepartmentIdsForUser(user) } },
    select: { id: true, nameAr: true },
    orderBy: { sortOrder: "asc" },
  });
  return <ActivityWizard departments={departments} allowGeneral={isAdmin} />;
}
