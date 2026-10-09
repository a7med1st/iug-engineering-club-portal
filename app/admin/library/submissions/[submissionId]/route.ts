import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS, canAccessDepartment, hasPermission } from "@/lib/permissions";
import { libraryDownloadResponse } from "@/lib/library/file-response";

export async function GET(request: Request, context: { params: Promise<{ submissionId: string }> }) {
  const auth = await getCurrentUser();
  if (!auth || !hasPermission(auth.user.role, PERMISSIONS.LIBRARY_MANAGE, auth.user.memberPermissions, auth.user.position)) return new Response(null, { status: 404 });
  const { submissionId } = await context.params;
  const submission = await prisma.librarySubmission.findUnique({ where: { id: submissionId } });
  if (!submission || !canAccessDepartment(auth.user, submission.departmentId)) return new Response(null, { status: 404 });
  return libraryDownloadResponse(request, submission);
}
