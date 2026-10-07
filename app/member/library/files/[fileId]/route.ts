import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { memberLibraryDepartmentIds } from "@/lib/permissions";
import { readLibraryFile } from "@/lib/library/storage";
import { isVisibleLibraryFolderPath } from "@/lib/library/tree";
import { isPreviewableLibraryMime } from "@/lib/library/file-response";
import { safeContentDisposition } from "@/lib/private-file-response";

function disposition(name: string, inline: boolean) {
  return safeContentDisposition(name, inline ? "inline" : "attachment");
}

export async function GET(request: Request, context: { params: Promise<{ fileId: string }> }) {
  const auth = await getCurrentUser();
  if (!auth || auth.user.role !== "MEMBER") return new Response(null, { status: 401 });
  const departmentIds = memberLibraryDepartmentIds(auth.user);
  if (!departmentIds.length) return new Response(null, { status: 404 });
  const { fileId } = await context.params;
  const file = await prisma.libraryFile.findFirst({
    where: { id: fileId, folder: { course: { departments: { some: { departmentId: { in: departmentIds } } } } } },
    select: { title: true, originalName: true, storageKey: true, mimeType: true, folderId: true, folder: { select: { courseId: true } } },
  });
  if (!file) return new Response(null, { status: 404 });
  const courseFolders = await prisma.libraryFolder.findMany({
    where: { courseId: file.folder.courseId },
    select: { id: true, courseId: true, parentId: true, name: true, sortOrder: true, isVisible: true },
  });
  if (!isVisibleLibraryFolderPath(courseFolders, file.folderId)) return new Response(null, { status: 404 });
  const stored = await readLibraryFile(file.storageKey);
  if (!stored?.stream) return new Response(null, { status: 404 });
  const download = new URL(request.url).searchParams.get("download") === "1";
  const previewable = isPreviewableLibraryMime(file.mimeType);
  const headers = new Headers();
  stored.headers.forEach((value, key) => headers.set(key, value));
  headers.set("content-type", file.mimeType);
  headers.set("content-disposition", disposition(file.originalName || file.title, previewable && !download));
  headers.set("cache-control", "private, no-store");
  headers.set("x-content-type-options", "nosniff");
  return new Response(stored.stream, { status: stored.statusCode, headers });
}
