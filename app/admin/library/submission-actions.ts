"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS, requireDepartmentPermission } from "@/lib/permissions";
import { canReviewLibrarySubmission } from "@/lib/library/submissions";
import { isVisibleLibraryFolderPath } from "@/lib/library/tree";

export async function reviewLibrarySubmissionAction(data: FormData) {
  const id = String(data.get("submissionId") ?? "");
  const decision = String(data.get("decision") ?? "");
  const folderId = String(data.get("folderId") ?? "");
  const departmentId = String(data.get("departmentId") ?? "");
  const back = `/admin/library?department=${encodeURIComponent(departmentId)}`;
  const submission = await prisma.librarySubmission.findUnique({ where: { id } });
  if (!submission || submission.departmentId !== departmentId) redirect(`${back}&error=${encodeURIComponent("الطلب غير موجود.")}`);
  const { user } = await requireDepartmentPermission(PERMISSIONS.LIBRARY_MANAGE, submission.departmentId);
  if (!canReviewLibrarySubmission(submission.status, submission.departmentId, departmentId)) redirect(`${back}&error=${encodeURIComponent("تمت مراجعة هذا الطلب بالفعل.")}`);
  if (decision === "approve") {
    const folder = await prisma.libraryFolder.findFirst({
      where: { id: folderId, course: { departments: { some: { departmentId } } } },
      select: { id: true, courseId: true },
    });
    if (!folder) redirect(`${back}&error=${encodeURIComponent("اختر مجلدًا في قسمك لنشر الملف.")}`);
    const courseFolders = await prisma.libraryFolder.findMany({ where: { courseId: folder.courseId }, select: { id: true, courseId: true, parentId: true, name: true, sortOrder: true, isVisible: true } });
    if (!isVisibleLibraryFolderPath(courseFolders, folder.id)) redirect(`${back}&error=${encodeURIComponent("اختر مجلدًا ظاهرًا للطلاب.")}`);
    const accepted = await prisma.$transaction(async (tx) => {
      const changed = await tx.librarySubmission.updateMany({ where: { id, status: "PENDING", departmentId }, data: { status: "APPROVED", reviewedById: user.id, reviewedAt: new Date() } });
      if (!changed.count) return false;
      const last = await tx.libraryFile.aggregate({ where: { folderId }, _max: { sortOrder: true } });
      const file = await tx.libraryFile.create({ data: {
        folderId, title: submission.title, originalName: submission.originalName,
        storageKey: submission.storageKey, mimeType: submission.mimeType, size: submission.size,
        uploadedById: submission.studentId, sortOrder: (last._max.sortOrder ?? -1) + 1,
      } });
      await tx.librarySubmission.update({ where: { id }, data: { publishedFileId: file.id } });
      return true;
    });
    if (!accepted) redirect(`${back}&error=${encodeURIComponent("تمت مراجعة هذا الطلب بالفعل.")}`);
    revalidatePath("/library");
  } else if (decision === "reject") {
    const changed = await prisma.librarySubmission.updateMany({ where: { id, status: "PENDING", departmentId }, data: { status: "REJECTED", reviewedById: user.id, reviewedAt: new Date() } });
    if (!changed.count) redirect(`${back}&error=${encodeURIComponent("تمت مراجعة هذا الطلب بالفعل.")}`);
  } else {
    redirect(`${back}&error=${encodeURIComponent("قرار غير صالح.")}`);
  }
  revalidatePath("/admin/library");
  redirect(`${back}&success=${encodeURIComponent(decision === "approve" ? "تم نشر الملف في المكتبة." : "تم رفض الطلب.")}`);
}
