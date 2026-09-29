import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { memberLibraryDepartmentIds, PERMISSIONS, requirePermission } from "@/lib/permissions";
import { isVisibleLibraryFolderPath } from "@/lib/library/tree";

export async function requireMemberLibraryAccess() {
  const { user } = await requirePermission(PERMISSIONS.MEMBER_DASHBOARD);
  if (user.role !== "MEMBER") redirect("/admin/library");
  return { user, departmentIds: memberLibraryDepartmentIds(user) };
}

export async function requireMemberLibraryCourse(courseId: string) {
  const { user, departmentIds } = await requireMemberLibraryAccess();
  const course = departmentIds.length ? await prisma.libraryCourse.findFirst({
    where: { id: courseId, departments: { some: { departmentId: { in: departmentIds } } } },
    select: { id: true, name: true, code: true, departments: { where: { departmentId: { in: departmentIds } }, select: { departmentId: true, level: true, semester: true, sortOrder: true }, take: 1 } },
  }) : null;
  if (!course) notFound();
  const placement = course.departments[0];
  if (!placement) notFound();
  return { user, course: { id: course.id, name: course.name, code: course.code, ...placement } };
}

export async function requireMemberLibraryFolder(folderId: string) {
  const { user, departmentIds } = await requireMemberLibraryAccess();
  const folder = departmentIds.length ? await prisma.libraryFolder.findFirst({
    where: { id: folderId, course: { departments: { some: { departmentId: { in: departmentIds } } } } },
    select: { id: true, courseId: true, parentId: true, course: { select: { departments: { where: { departmentId: { in: departmentIds } }, select: { departmentId: true }, take: 1 } } } },
  }) : null;
  if (!folder) notFound();
  const courseFolders = await prisma.libraryFolder.findMany({
    where: { courseId: folder.courseId },
    select: { id: true, courseId: true, parentId: true, name: true, sortOrder: true, isVisible: true },
  });
  if (!isVisibleLibraryFolderPath(courseFolders, folder.id)) notFound();
  return { user, folder };
}
