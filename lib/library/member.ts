import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { memberLibraryDepartmentIds, PERMISSIONS, requirePermission } from "@/lib/permissions";

export async function requireMemberLibraryAccess() {
  const { user } = await requirePermission(PERMISSIONS.MEMBER_DASHBOARD);
  if (user.role !== "MEMBER") redirect("/admin/library");
  return { user, departmentIds: memberLibraryDepartmentIds(user) };
}

export async function requireMemberLibraryCourse(courseId: string) {
  const { user, departmentIds } = await requireMemberLibraryAccess();
  const course = departmentIds.length ? await prisma.libraryCourse.findFirst({
    where: { id: courseId, departmentId: { in: departmentIds } },
    select: { id: true, name: true, code: true, level: true, departmentId: true },
  }) : null;
  if (!course) notFound();
  return { user, course };
}

export async function requireMemberLibraryFolder(folderId: string) {
  const { user, departmentIds } = await requireMemberLibraryAccess();
  const folder = departmentIds.length ? await prisma.libraryFolder.findFirst({
    where: { id: folderId, isVisible: true, course: { departmentId: { in: departmentIds } } },
    select: { id: true, courseId: true, course: { select: { departmentId: true } } },
  }) : null;
  if (!folder) notFound();
  return { user, folder };
}
