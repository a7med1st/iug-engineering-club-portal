import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS, hasPermission } from "@/lib/permissions";
import { isVisibleLibraryFolderPath } from "@/lib/library/tree";
import { libraryDownloadResponse } from "@/lib/library/file-response";

export async function GET(request: Request, context: { params: Promise<{ fileId: string }> }) {
  const auth = await getCurrentUser();
  if (!auth) return new Response(null, { status: 401 });
  if (!hasPermission(auth.user.role, PERMISSIONS.STUDENT_DASHBOARD, auth.user.memberPermissions, auth.user.position) || !auth.user.departmentId) {
    return new Response(null, { status: 404 });
  }
  const { fileId } = await context.params;
  const file = await prisma.libraryFile.findFirst({
    where: { id: fileId, folder: { course: { departments: { some: { departmentId: auth.user.departmentId } } } } },
    select: { title: true, originalName: true, storageKey: true, mimeType: true, folderId: true, folder: { select: { courseId: true } } },
  });
  if (!file) return new Response(null, { status: 404 });
  const courseFolders = await prisma.libraryFolder.findMany({
    where: { courseId: file.folder.courseId },
    select: { id: true, courseId: true, parentId: true, name: true, sortOrder: true, isVisible: true },
  });
  if (!isVisibleLibraryFolderPath(courseFolders, file.folderId)) return new Response(null, { status: 404 });
  return libraryDownloadResponse(request, file);
}
