import type { PermissionUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getManageableLibraryDepartments } from "./authorization";
import { directLibraryChildren, libraryFolderBreadcrumb, type LibraryFolderNode } from "./tree";

export function pickLibrarySelection<T extends { id: string }>(requested: string | undefined, items: T[]) {
  return items.find((item) => item.id === requested) ?? items[0] ?? null;
}

export function resolveLibraryFolderNavigation<T extends LibraryFolderNode>(
  allFolders: readonly T[],
  requestedFolderId: string | undefined,
) {
  const requestedFolder = requestedFolderId
    ? allFolders.find((folder) => folder.id === requestedFolderId) ?? null
    : null;
  const folderBreadcrumb = requestedFolder
    ? libraryFolderBreadcrumb(allFolders, requestedFolder.id)
    : [];
  const selectedFolder = folderBreadcrumb ? requestedFolder : null;
  return {
    selectedFolder,
    folderBreadcrumb: folderBreadcrumb ?? [],
    folders: directLibraryChildren(allFolders, selectedFolder?.id ?? null) as T[],
  };
}

export async function resolveLibrarySelection(user: PermissionUser, params: { department?: string; course?: string; folder?: string }) {
  const departments = await getManageableLibraryDepartments(user);
  const selectedDepartment = pickLibrarySelection(params.department, departments);
  const placements = selectedDepartment ? await prisma.libraryCourseDepartment.findMany({ where: { departmentId: selectedDepartment.id }, include: { course: { include: { _count: { select: { folders: true } }, departments: { select: { department: { select: { id: true, nameAr: true } } } } } } }, orderBy: [{ level: "asc" }, { semester: "asc" }, { sortOrder: "asc" }, { course: { name: "asc" } }] }) : [];
  const courses = placements.map(({ course, level, semester, sortOrder }) => ({ ...course, level, semester, sortOrder }));
  const selectedCourse = pickLibrarySelection(params.course, courses);
  const allFolders = selectedCourse ? await prisma.libraryFolder.findMany({ where: { courseId: selectedCourse.id }, include: { _count: { select: { files: true, links: true } } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }] }) : [];
  const { folders, selectedFolder, folderBreadcrumb } = resolveLibraryFolderNavigation(allFolders, params.folder);
  const files = selectedFolder ? await prisma.libraryFile.findMany({ where: { folderId: selectedFolder.id }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { title: "asc" }] }) : [];
  const links = selectedFolder ? await prisma.libraryLink.findMany({ where: { folderId: selectedFolder.id }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { title: "asc" }] }) : [];
  return { departments, selectedDepartment, courses, selectedCourse, folders, selectedFolder, folderBreadcrumb, files, links };
}

