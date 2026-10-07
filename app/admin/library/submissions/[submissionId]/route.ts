import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS, canAccessDepartment, hasPermission } from "@/lib/permissions";
import { readLibraryFile } from "@/lib/library/storage";
import { isPreviewableLibraryMime } from "@/lib/library/file-response";
import { safeContentDisposition } from "@/lib/private-file-response";

export async function GET(request: Request, context: { params: Promise<{ submissionId: string }> }) {
  const auth = await getCurrentUser();
  if (!auth || !hasPermission(auth.user.role, PERMISSIONS.LIBRARY_MANAGE, auth.user.memberPermissions, auth.user.position)) return new Response(null, { status: 404 });
  const { submissionId } = await context.params;
  const submission = await prisma.librarySubmission.findUnique({ where: { id: submissionId } });
  if (!submission || !canAccessDepartment(auth.user, submission.departmentId)) return new Response(null, { status: 404 });
  const stored = await readLibraryFile(submission.storageKey);
  if (!stored?.stream) return new Response(null, { status: 404 });
  const inline = isPreviewableLibraryMime(submission.mimeType) && new URL(request.url).searchParams.get("download") !== "1";
  const headers = new Headers();
  stored.headers.forEach((value, key) => headers.set(key, value));
  headers.set("content-type", submission.mimeType);
  headers.set("content-disposition", safeContentDisposition(submission.originalName, inline ? "inline" : "attachment"));
  headers.set("cache-control", "private, no-store");
  headers.set("x-content-type-options", "nosniff");
  return new Response(stored.stream, { status: stored.statusCode, headers });
}
