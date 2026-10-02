"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireMemberLibraryCourse, requireMemberLibraryFolder } from "@/lib/library/member";
import { requireMemberLibraryAccess } from "@/lib/library/member";
import { createOrAttachLibraryCourse } from "@/lib/library/courses";
import { deleteLibraryFiles } from "@/lib/library/storage";
import { libraryFolderDescendantIds } from "@/lib/library/tree";
import { normalizeLibraryCourseCode } from "@/lib/library/course-code";
import { libraryAdjacentSwap } from "@/lib/library/ordering";
import { LibraryValidationError, validateLibraryCourseInput, validateLibraryFileTitle, validateLibraryFolderInput, validateLibraryLinkInput } from "@/lib/library/validation";

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
  let result: Awaited<ReturnType<typeof createOrAttachLibraryCourse>>;
  try {
    const input = validateLibraryCourseInput(Object.fromEntries(data));
    result = await createOrAttachLibraryCourse(input, user.departmentId, String(data.get("confirmExisting")) === "true");
  } catch (error) {
    const value = error instanceof LibraryValidationError ? error.message : "تعذر إضافة المساق.";
    redirect(`/member/library?error=${encodeURIComponent(value)}`);
  }
  refresh(result.courseId);
  redirect(`/member/library?course=${result.courseId}&success=${encodeURIComponent(result.attached ? "تم ربط المساق ومحتواه بقسمك." : "تمت إضافة المساق.")}`);
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

export async function moveMemberLinkAction(data: FormData) {
  const direction = String(data.get("direction"));
  if (direction !== "up" && direction !== "down") throw new LibraryValidationError("اتجاه الترتيب غير صالح.");
  const link = await prisma.libraryLink.findUnique({ where: { id: String(data.get("linkId") ?? "") }, select: { id: true, folderId: true } });
  if (!link) throw new LibraryValidationError("الرابط غير موجود.");
  const { folder } = await requireMemberLibraryFolder(link.folderId);
  const siblings = await prisma.libraryLink.findMany({ where: { folderId: folder.id }, select: { id: true, sortOrder: true, createdAt: true } });
  const change = libraryAdjacentSwap(siblings, link.id, direction);
  await prisma.$transaction([...change.normalized, ...change.swap].map((item) => prisma.libraryLink.update({ where: { id: item.id }, data: { sortOrder: item.sortOrder } })));
  refresh(folder.courseId, folder.id);
  back(folder.courseId, folder.id, "success", "تم تحديث ترتيب الرابط.");
}

export async function addMemberLibraryLink(data: FormData) {
  const { folder } = await requireMemberLibraryFolder(String(data.get("folderId") ?? ""));
  try {
    const input = validateLibraryLinkInput(Object.fromEntries(data));
    const last = await prisma.libraryLink.aggregate({ where: { folderId: folder.id }, _max: { sortOrder: true } });
    await prisma.libraryLink.create({ data: { folderId: folder.id, ...input, sortOrder: (last._max.sortOrder ?? -1) + 1 } });
    refresh(folder.courseId, folder.id);
    back(folder.courseId, folder.id, "success", "تمت إضافة الرابط.");
  } catch (error) {
    if (error instanceof LibraryValidationError) back(folder.courseId, folder.id, "error", error.message);
    throw error;
  }
}

export async function updateMemberCourseAction(data: FormData) {
  const { course } = await requireMemberLibraryCourse(String(data.get("courseId") ?? ""));
  try {
    const input = validateLibraryCourseInput(Object.fromEntries(data));
    await prisma.$transaction([
      prisma.libraryCourse.update({ where: { id: course.id }, data: { name: input.name, code: input.code, normalizedCode: normalizeLibraryCourseCode(input.code), description: input.description } }),
      prisma.libraryCourseDepartment.update({ where: { courseId_departmentId: { courseId: course.id, departmentId: course.departmentId } }, data: { level: input.level, semester: input.semester, sortOrder: input.sortOrder } }),
    ]);
    refresh(course.id);
  } catch (error) {
    if (error instanceof LibraryValidationError) back(course.id, null, "error", error.message);
    throw error;
  }
  back(course.id, null, "success", "تم تعديل المساق.");
}

export async function deleteMemberCourseAction(data: FormData) {
  const { course } = await requireMemberLibraryCourse(String(data.get("courseId") ?? ""));
  const placements = await prisma.libraryCourseDepartment.count({ where: { courseId: course.id } });
  if (placements > 1) {
    await prisma.libraryCourseDepartment.delete({ where: { courseId_departmentId: { courseId: course.id, departmentId: course.departmentId } } });
  } else {
    const files = await prisma.libraryFile.findMany({ where: { folder: { courseId: course.id } }, select: { storageKey: true } });
    await deleteLibraryFiles(files.map((file) => file.storageKey));
    await prisma.libraryCourse.delete({ where: { id: course.id } });
  }
  refresh(course.id);
  redirect("/member/library?success=" + encodeURIComponent("تم حذف المساق."));
}

export async function updateMemberFolderAction(data: FormData) {
  const { folder } = await requireMemberLibraryFolder(String(data.get("folderId") ?? ""));
  const input = validateLibraryFolderInput({ name: data.get("name"), sortOrder: data.get("sortOrder"), isVisible: true });
  await prisma.libraryFolder.update({ where: { id: folder.id }, data: input });
  refresh(folder.courseId, folder.id);
  back(folder.courseId, folder.id, "success", "تم تعديل المجلد.");
}

export async function deleteMemberFolderAction(data: FormData) {
  const { folder } = await requireMemberLibraryFolder(String(data.get("folderId") ?? ""));
  const folders = await prisma.libraryFolder.findMany({ where: { courseId: folder.courseId }, select: { id: true, courseId: true, parentId: true, name: true, sortOrder: true, isVisible: true } });
  const subtreeIds = libraryFolderDescendantIds(folders, folder.id);
  if (!subtreeIds) throw new LibraryValidationError("تعذر قراءة بنية المجلد.");
  const files = await prisma.libraryFile.findMany({ where: { folderId: { in: subtreeIds } }, select: { storageKey: true } });
  await deleteLibraryFiles(files.map((file) => file.storageKey));
  await prisma.libraryFolder.delete({ where: { id: folder.id } });
  refresh(folder.courseId, folder.parentId ?? undefined);
  back(folder.courseId, folder.parentId, "success", "تم حذف المجلد.");
}

export async function updateMemberLinkAction(data: FormData) {
  const link = await prisma.libraryLink.findUnique({ where: { id: String(data.get("linkId") ?? "") }, select: { id: true, folderId: true } });
  if (!link) throw new LibraryValidationError("الرابط غير موجود.");
  const { folder } = await requireMemberLibraryFolder(link.folderId);
  const input = validateLibraryLinkInput(Object.fromEntries(data));
  await prisma.libraryLink.update({ where: { id: link.id }, data: input });
  refresh(folder.courseId, folder.id);
  back(folder.courseId, folder.id, "success", "تم تعديل الرابط.");
}

export async function deleteMemberLinkAction(data: FormData) {
  const link = await prisma.libraryLink.findUnique({ where: { id: String(data.get("linkId") ?? "") }, select: { id: true, folderId: true } });
  if (!link) throw new LibraryValidationError("الرابط غير موجود.");
  const { folder } = await requireMemberLibraryFolder(link.folderId);
  await prisma.libraryLink.delete({ where: { id: link.id } });
  refresh(folder.courseId, folder.id);
  back(folder.courseId, folder.id, "success", "تم حذف الرابط.");
}

export async function updateMemberFileAction(data: FormData) {
  const file = await prisma.libraryFile.findUnique({ where: { id: String(data.get("fileId") ?? "") }, select: { id: true, folderId: true } });
  if (!file) throw new LibraryValidationError("الملف غير موجود.");
  const { folder } = await requireMemberLibraryFolder(file.folderId);
  await prisma.libraryFile.update({ where: { id: file.id }, data: { title: validateLibraryFileTitle(data.get("title")) } });
  refresh(folder.courseId, folder.id);
  back(folder.courseId, folder.id, "success", "تم تعديل اسم الملف.");
}

export async function deleteMemberFileAction(data: FormData) {
  const file = await prisma.libraryFile.findUnique({ where: { id: String(data.get("fileId") ?? "") }, select: { id: true, folderId: true, storageKey: true } });
  if (!file) throw new LibraryValidationError("الملف غير موجود.");
  const { folder } = await requireMemberLibraryFolder(file.folderId);
  await deleteLibraryFiles([file.storageKey]);
  await prisma.libraryFile.delete({ where: { id: file.id } });
  refresh(folder.courseId, folder.id);
  back(folder.courseId, folder.id, "success", "تم حذف الملف.");
}
