import { notFound } from "next/navigation";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { isVisibleLibraryFolderPath, libraryFolderBreadcrumb } from "@/lib/library/tree";

export async function getStudentLibraryDepartment() {
  const { user } = await requirePermission(PERMISSIONS.STUDENT_DASHBOARD);
  if (!user.departmentId) return null;
  return prisma.department.findUnique({
    where: { id: user.departmentId },
    select: { id: true, nameAr: true },
  });
}

export async function getStudentLibraryCourse(courseId: string) {
  const department = await getStudentLibraryDepartment();
  if (!department) notFound();
  const course = await prisma.libraryCourse.findFirst({
    where: { id: courseId, departments: { some: { departmentId: department.id } } },
    select: { id: true, name: true, code: true, description: true, departments: { where: { departmentId: department.id }, select: { level: true, semester: true, sortOrder: true }, take: 1 } },
  });
  if (!course) notFound();
  const placement = course.departments[0];
  if (!placement) notFound();
  return { department, course: { id: course.id, name: course.name, code: course.code, description: course.description, ...placement } };
}

export async function getStudentLibraryFolder(courseId: string, folderId: string) {
  const { department, course } = await getStudentLibraryCourse(courseId);
  const folder = await prisma.libraryFolder.findFirst({
    where: { id: folderId, courseId: course.id },
    select: { id: true, courseId: true, parentId: true, name: true, sortOrder: true, isVisible: true },
  });
  if (!folder) notFound();
  const allFolders = await prisma.libraryFolder.findMany({
    where: { courseId: course.id },
    select: { id: true, courseId: true, parentId: true, name: true, sortOrder: true, isVisible: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  if (!isVisibleLibraryFolderPath(allFolders, folder.id)) notFound();
  const folderBreadcrumb = libraryFolderBreadcrumb(allFolders, folder.id);
  if (!folderBreadcrumb) notFound();
  return { department, course, folder, allFolders, folderBreadcrumb };
}
