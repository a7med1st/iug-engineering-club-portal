import type { PermissionUser } from "@/lib/permissions";
import { PERMISSIONS, canAccessDepartment, isClubLeadership, managedDepartmentIdsForUser, requirePermission } from "@/lib/permissions";
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

async function authorizedPlacement(departmentIds: string[], preferredDepartmentId?: string) {
  const { user } = await requirePermission(PERMISSIONS.LIBRARY_MANAGE);
  const candidates = preferredDepartmentId ? departmentIds.filter((id) => id === preferredDepartmentId) : departmentIds;
  const departmentId = candidates.find((id) => canAccessDepartment(user, id));
  return departmentId ? { user, departmentId } : null;
}

export async function requireLibraryCourse(id: string, preferredDepartmentId?: string) {
  const resource = await prisma.libraryCourse.findUnique({ where: { id }, select: { id: true, departments: { select: { departmentId: true } } } });
  if (!resource) return null;
  const access = await authorizedPlacement(resource.departments.map((item) => item.departmentId), preferredDepartmentId);
  return access ? { id: resource.id, departmentId: access.departmentId } : null;
}

export async function requireLibraryFolder(id: string) {
  const resource = await prisma.libraryFolder.findUnique({ where: { id }, select: { id: true, courseId: true, parentId: true, course: { select: { departments: { select: { departmentId: true } } } } } });
  if (!resource) return null;
  const access = await authorizedPlacement(resource.course.departments.map((item) => item.departmentId));
  return access ? { id: resource.id, courseId: resource.courseId, parentId: resource.parentId, departmentId: access.departmentId } : null;
}

export async function requireLibraryFile(id: string) {
  const resource = await prisma.libraryFile.findUnique({ where: { id }, select: { id: true, title: true, originalName: true, storageKey: true, mimeType: true, size: true, folder: { select: { course: { select: { departments: { select: { departmentId: true } } } } } } } });
  if (!resource) return null;
  const access = await authorizedPlacement(resource.folder.course.departments.map((item) => item.departmentId));
  return access ? { ...resource, departmentId: access.departmentId } : null;
}

export async function requireLibraryLink(id: string) {
  const resource = await prisma.libraryLink.findUnique({ where: { id }, select: { id: true, folder: { select: { course: { select: { departments: { select: { departmentId: true } } } } } } } });
  if (!resource) return null;
  const access = await authorizedPlacement(resource.folder.course.departments.map((item) => item.departmentId));
  return access ? resource : null;
}
