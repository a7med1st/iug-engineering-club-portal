import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS, canAccessDepartment, hasPermission } from "@/lib/permissions";
import { libraryDownloadResponse } from "@/lib/library/file-response";

export async function GET(request: Request, context: { params: Promise<{ fileId: string }> }) {
  const auth = await getCurrentUser();
  if (!auth) return new Response(null, { status: 401 });
  const { fileId } = await context.params;
  const file = await prisma.libraryFile.findUnique({ where: { id: fileId }, select: { title: true, originalName: true, storageKey: true, mimeType: true, folder: { select: { course: { select: { departments: { select: { departmentId: true } } } } } } } });
  if (!file || !hasPermission(auth.user.role, PERMISSIONS.LIBRARY_MANAGE, auth.user.memberPermissions, auth.user.position) || !file.folder.course.departments.some((item) => canAccessDepartment(auth.user, item.departmentId))) return new Response(null, { status: 404 });
  return libraryDownloadResponse(request, file);
}
