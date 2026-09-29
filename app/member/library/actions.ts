"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireMemberLibraryCourse, requireMemberLibraryFolder } from "@/lib/library/member";
import { requireMemberLibraryAccess } from "@/lib/library/member";
import { createOrAttachLibraryCourse } from "@/lib/library/courses";
import { libraryAdjacentSwap } from "@/lib/library/ordering";
import { LibraryValidationError, validateLibraryCourseInput, validateLibraryFolderInput, validateLibraryLinkInput } from "@/lib/library/validation";

function back(courseId: string, folderId: string | null, kind: "success" | "error", message: string): never {
  const params = new URLSearchParams({ course: courseId, [kind]: message });
  if (folderId) params.set("folder", folderId);
  redirect(`/member/library?${params}`);
}

function refresh(courseId: string, folderId?: string) {
  revalidatePath("/member/library");
  revalidatePath("/admin/library");
  revalidatePath(`/library/courses/${courseId}`);
  if (folderId) revalidatePath(`/library/courses/${courseId}/folders/${folderId}`);
}

export async function addMemberLibraryFolder(data: FormData) {
  const { user, course } = await requireMemberLibraryCourse(String(data.get("courseId") ?? ""));
  try {
    const parentId = String(data.get("parentId") ?? "").trim() || null;
    const parent = parentId ? (await requireMemberLibraryFolder(parentId)).folder : null;
    if (parentId && (!parent || parent.courseId !== course.id)) throw new LibraryValidationError("المجلد الأب غير صالح.");
    const input = validateLibraryFolderInput({ name: data.get("name"), sortOrder: 0, isVisible: true });
    const last = await prisma.libraryFolder.aggregate({ where: { courseId: course.id, parentId }, _max: { sortOrder: true } });
    input.sortOrder = (last._max.sortOrder ?? -1) + 1;
    const folder = await prisma.libraryFolder.create({ data: { courseId: course.id, parentId, createdById: user.id, ...input } });
    refresh(course.id, folder.id);
    back(course.id, folder.id, "success", "تمت إضافة المجلد.");
  } catch (error) {
    if (error instanceof LibraryValidationError) back(course.id, null, "error", error.message);
    throw error;
  }
}

export async function createMemberCourseAction(data: FormData) {
  const { user } = await requireMemberLibraryAccess();
  if (!user.departmentId) redirect("/member/library?error=" + encodeURIComponent("لا يوجد قسم مرتبط بحسابك."));
  try {
    const input = validateLibraryCourseInput(Object.fromEntries(data));
    const result = await createOrAttachLibraryCourse(input, user.departmentId, String(data.get("confirmExisting")) === "true");
    refresh(result.courseId);
    redirect(`/member/library?course=${result.courseId}&success=${encodeURIComponent(result.attached ? "تم ربط المساق ومحتواه بقسمك." : "تمت إضافة المساق.")}`);
  } catch (error) {
    const value = error instanceof LibraryValidationError ? error.message : "تعذر إضافة المساق.";
    redirect(`/member/library?error=${encodeURIComponent(value)}`);
  }
}

async function moveMemberItem(data: FormData, kind: "folder" | "file") {
  const direction = String(data.get("direction"));
  if (direction !== "up" && direction !== "down") throw new LibraryValidationError("اتجاه الترتيب غير صالح.");
  if (kind === "folder") {
    const { folder } = await requireMemberLibraryFolder(String(data.get("folderId") ?? ""));
    const siblings = await prisma.libraryFolder.findMany({ where: { courseId: folder.courseId, parentId: folder.parentId }, select: { id: true, sortOrder: true, createdAt: true } });
    const change = libraryAdjacentSwap(siblings, folder.id, direction);
    await prisma.$transaction([...change.normalized, ...change.swap].map((item) => prisma.libraryFolder.update({ where: { id: item.id }, data: { sortOrder: item.sortOrder } })));
    refresh(folder.courseId, folder.parentId ?? undefined);
  } else {
    const fileId = String(data.get("fileId") ?? "");
    const file = await prisma.libraryFile.findUnique({ where: { id: fileId }, select: { id: true, folderId: true } });
    if (!file) throw new LibraryValidationError("الملف غير موجود.");
    const { folder } = await requireMemberLibraryFolder(file.folderId);
    const siblings = await prisma.libraryFile.findMany({ where: { folderId: folder.id }, select: { id: true, sortOrder: true, createdAt: true } });
    const change = libraryAdjacentSwap(siblings, file.id, direction);
    await prisma.$transaction([...change.normalized, ...change.swap].map((item) => prisma.libraryFile.update({ where: { id: item.id }, data: { sortOrder: item.sortOrder } })));
    refresh(folder.courseId, folder.id);
  }
}

export async function moveMemberFolderAction(data: FormData) {
  await moveMemberItem(data, "folder");
  back(String(data.get("course") ?? ""), String(data.get("folder") ?? "") || null, "success", "تم تحديث ترتيب المجلد.");
}

export async function moveMemberFileAction(data: FormData) {
  await moveMemberItem(data, "file");
  back(String(data.get("course") ?? ""), String(data.get("folder") ?? "") || null, "success", "تم تحديث ترتيب الملف.");
}

export async function addMemberLibraryLink(data: FormData) {
  const { folder } = await requireMemberLibraryFolder(String(data.get("folderId") ?? ""));
  try {
    const input = validateLibraryLinkInput(Object.fromEntries(data));
    await prisma.libraryLink.create({ data: { folderId: folder.id, ...input } });
    refresh(folder.courseId, folder.id);
    back(folder.courseId, folder.id, "success", "تمت إضافة الرابط.");
  } catch (error) {
    if (error instanceof LibraryValidationError) back(folder.courseId, folder.id, "error", error.message);
    throw error;
  }
}
