import { notFound } from "next/navigation";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

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
    where: { id: courseId, departmentId: department.id },
    select: { id: true, name: true, code: true, description: true, level: true },
  });
  if (!course) notFound();
  return { department, course };
}

export async function getStudentLibraryFolder(courseId: string, folderId: string) {
  const { department, course } = await getStudentLibraryCourse(courseId);
  const folder = await prisma.libraryFolder.findFirst({
    where: { id: folderId, courseId: course.id, isVisible: true },
    select: { id: true, name: true },
  });
  if (!folder) notFound();
  return { department, course, folder };
}
