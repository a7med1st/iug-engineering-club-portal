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
  const courses = selectedDepartment ? await prisma.libraryCourse.findMany({ where: { departmentId: selectedDepartment.id }, include: { _count: { select: { folders: true } } }, orderBy: [{ level: "asc" }, { semester: "asc" }, { sortOrder: "asc" }, { name: "asc" }] }) : [];
  const selectedCourse = pickLibrarySelection(params.course, courses);
  const allFolders = selectedCourse ? await prisma.libraryFolder.findMany({ where: { courseId: selectedCourse.id }, include: { _count: { select: { files: true, links: true } } }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }) : [];
  const { folders, selectedFolder, folderBreadcrumb } = resolveLibraryFolderNavigation(allFolders, params.folder);
  const files = selectedFolder ? await prisma.libraryFile.findMany({ where: { folderId: selectedFolder.id }, orderBy: [{ createdAt: "desc" }, { title: "asc" }] }) : [];
  const links = selectedFolder ? await prisma.libraryLink.findMany({ where: { folderId: selectedFolder.id }, orderBy: [{ createdAt: "desc" }, { title: "asc" }] }) : [];
  return { departments, selectedDepartment, courses, selectedCourse, folders, selectedFolder, folderBreadcrumb, files, links };
}

