import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS, hasPermission } from "@/lib/permissions";
import { readLibraryFile } from "@/lib/library/storage";

function disposition(name: string, inline: boolean) {
  const safe = name.replace(/["\\\r\n]/g, "_");
  return `${inline ? "inline" : "attachment"}; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export async function GET(request: Request, context: { params: Promise<{ fileId: string }> }) {
  const auth = await getCurrentUser();
  if (!auth) return new Response(null, { status: 401 });
  if (!hasPermission(auth.user.role, PERMISSIONS.STUDENT_DASHBOARD, auth.user.memberPermissions, auth.user.position) || !auth.user.departmentId) {
    return new Response(null, { status: 404 });
  }
  const { fileId } = await context.params;
  const file = await prisma.libraryFile.findFirst({
    where: { id: fileId, folder: { isVisible: true, course: { departmentId: auth.user.departmentId } } },
    select: { title: true, originalName: true, storageKey: true, mimeType: true },
  });
  if (!file) return new Response(null, { status: 404 });
  const stored = await readLibraryFile(file.storageKey);
  if (!stored?.stream) return new Response(null, { status: 404 });

  const download = new URL(request.url).searchParams.get("download") === "1";
  const previewable = file.mimeType === "application/pdf" || file.mimeType.startsWith("image/");
  const headers = new Headers();
  stored.headers.forEach((value, key) => headers.set(key, value));
  headers.set("content-type", file.mimeType);
  headers.set("content-disposition", disposition(file.originalName || file.title, previewable && !download));
  headers.set("cache-control", "private, no-store");
  headers.set("x-content-type-options", "nosniff");
  return new Response(stored.stream, { status: stored.statusCode, headers });
}
