import { prisma } from "@/lib/prisma";
import { isVisibleLibraryFolderPath } from "@/lib/library/tree";
import { libraryDownloadResponse } from "@/lib/library/file-response";

export async function GET(request: Request, context: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await context.params;
  const file = await prisma.libraryFile.findFirst({
    where: { id: fileId, folder: { course: { departments: { some: {} } } } },
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
