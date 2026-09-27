import type { PermissionUser } from "@/lib/permissions";
import { PERMISSIONS, isClubLeadership, managedDepartmentIdsForUser, requireDepartmentPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function getManageableLibraryDepartments(user: PermissionUser) {
  const global = user.role === "ADMIN" || isClubLeadership(user.position);
  const ids = managedDepartmentIdsForUser(user);
  return prisma.department.findMany({
    where: global ? undefined : { id: { in: ids.length ? ids : ["__NONE__"] } },
    select: { id: true, nameAr: true, slug: true },
    orderBy: [{ sortOrder: "asc" }, { nameAr: "asc" }],
  });
}

export async function requireLibraryCourse(id: string) {
  const resource = await prisma.libraryCourse.findUnique({ where: { id }, select: { id: true, departmentId: true } });
  if (!resource) return null;
  await requireDepartmentPermission(PERMISSIONS.LIBRARY_MANAGE, resource.departmentId);
  return resource;
}

export async function requireLibraryFolder(id: string) {
  const resource = await prisma.libraryFolder.findUnique({ where: { id }, select: { id: true, courseId: true, course: { select: { departmentId: true } } } });
  if (!resource) return null;
  await requireDepartmentPermission(PERMISSIONS.LIBRARY_MANAGE, resource.course.departmentId);
  return { ...resource, departmentId: resource.course.departmentId };
}

export async function requireLibraryFile(id: string) {
  const resource = await prisma.libraryFile.findUnique({ where: { id }, select: { id: true, title: true, originalName: true, storageKey: true, mimeType: true, size: true, folder: { select: { course: { select: { departmentId: true } } } } } });
  if (!resource) return null;
  const departmentId = resource.folder.course.departmentId;
  await requireDepartmentPermission(PERMISSIONS.LIBRARY_MANAGE, departmentId);
  return { ...resource, departmentId };
}

export async function requireLibraryLink(id: string) {
  const resource = await prisma.libraryLink.findUnique({ where: { id }, select: { id: true, folder: { select: { course: { select: { departmentId: true } } } } } });
  if (!resource) return null;
  await requireDepartmentPermission(PERMISSIONS.LIBRARY_MANAGE, resource.folder.course.departmentId);
  return resource;
}
