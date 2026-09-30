"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS, requireDepartmentPermission } from "@/lib/permissions";
import { requireLibraryCourse, requireLibraryFile, requireLibraryFolder, requireLibraryLink } from "@/lib/library/authorization";
import { deleteLibraryFiles } from "@/lib/library/storage";
import { libraryFolderDescendantIds } from "@/lib/library/tree";
import { createOrAttachLibraryCourse } from "@/lib/library/courses";
import { normalizeLibraryCourseCode } from "@/lib/library/course-code";
import { libraryAdjacentSwap } from "@/lib/library/ordering";
import { LibraryValidationError, validateLibraryCourseInput, validateLibraryFileTitle, validateLibraryFolderInput, validateLibraryLinkInput } from "@/lib/library/validation";

const text = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const back = (data: FormData, kind: "success" | "error", message: string): never => {
  const params = new URLSearchParams();
  for (const key of ["department", "course", "folder"]) { const value = text(data, key); if (value) params.set(key, value); }
  params.set(kind, message);
  redirect(`/admin/library?${params}`);
};
const refresh = () => revalidatePath("/admin/library");
const message = (error: unknown) => error instanceof LibraryValidationError ? error.message : "تعذر إكمال العملية. حاول مرة أخرى.";

export async function createCourseAction(data: FormData) {
  try {
    const departmentId = text(data, "departmentId");
    await requireDepartmentPermission(PERMISSIONS.LIBRARY_MANAGE, departmentId);
    const input = validateLibraryCourseInput(Object.fromEntries(data));
    await createOrAttachLibraryCourse(input, departmentId, text(data, "confirmExisting") === "true"); refresh();
  } catch (error) { back(data, "error", message(error)); }
  back(data, "success", "تمت إضافة المساق.");
}

export async function updateCourseAction(data: FormData) {
  try {
    const course = await requireLibraryCourse(text(data, "courseId"), text(data, "department")); if (!course) throw new LibraryValidationError("المساق غير موجود.");
    const input = validateLibraryCourseInput(Object.fromEntries(data));
    await prisma.$transaction([
      prisma.libraryCourse.update({ where: { id: course.id }, data: { name: input.name, code: input.code, normalizedCode: normalizeLibraryCourseCode(input.code), description: input.description } }),
      prisma.libraryCourseDepartment.update({ where: { courseId_departmentId: { courseId: course.id, departmentId: course.departmentId } }, data: { level: input.level, semester: input.semester, sortOrder: input.sortOrder } }),
    ]); refresh();
  } catch (error) { back(data, "error", message(error)); }
  back(data, "success", "تم تحديث المساق.");
}

export async function deleteCourseAction(data: FormData) {
  try {
    const course = await requireLibraryCourse(text(data, "courseId"), text(data, "department")); if (!course) throw new LibraryValidationError("المساق غير موجود.");
    const placementCount = await prisma.libraryCourseDepartment.count({ where: { courseId: course.id } });
    if (placementCount > 1) {
      await prisma.libraryCourseDepartment.delete({ where: { courseId_departmentId: { courseId: course.id, departmentId: course.departmentId } } });
    } else {
      const files = await prisma.libraryFile.findMany({ where: { folder: { courseId: course.id } }, select: { storageKey: true } });
      await deleteLibraryFiles(files.map((file) => file.storageKey));
      await prisma.libraryCourse.delete({ where: { id: course.id } });
    }
    refresh();
  } catch { back(data, "error", "تعذر حذف المساق وملفاته."); }
  data.delete("course"); data.delete("folder"); back(data, "success", "تم حذف المساق.");
}

export async function createFolderAction(data: FormData) {
  try {
    const course = await requireLibraryCourse(text(data, "courseId"), text(data, "department")); if (!course) throw new LibraryValidationError("المساق غير موجود.");
    const auth = await requireDepartmentPermission(PERMISSIONS.LIBRARY_MANAGE, course.departmentId);
    const parentId = text(data, "parentId") || null;
    const parent = parentId ? await requireLibraryFolder(parentId) : null;
    if (parentId && (!parent || parent.courseId !== course.id)) throw new LibraryValidationError("المجلد الأب غير صالح.");
    const input = validateLibraryFolderInput(Object.fromEntries(data));
    const last = await prisma.libraryFolder.aggregate({ where: { courseId: course.id, parentId }, _max: { sortOrder: true } });
    const folder = await prisma.libraryFolder.create({ data: { courseId: course.id, parentId, createdById: auth.user.id, ...input, sortOrder: (last._max.sortOrder ?? -1) + 1 } });
    data.set("folder", folder.id); refresh();
  } catch (error) { back(data, "error", message(error)); }
  back(data, "success", "تم إنشاء المجلد.");
}

export async function updateFolderAction(data: FormData) {
  try {
    const folder = await requireLibraryFolder(text(data, "folderId")); if (!folder) throw new LibraryValidationError("المجلد غير موجود.");
    await prisma.libraryFolder.update({ where: { id: folder.id }, data: validateLibraryFolderInput(Object.fromEntries(data)) }); refresh();
  } catch (error) { back(data, "error", message(error)); }
  back(data, "success", "تم تحديث المجلد.");
}

export async function deleteFolderAction(data: FormData) {
  try {
    const folder = await requireLibraryFolder(text(data, "folderId")); if (!folder) throw new LibraryValidationError("المجلد غير موجود.");
    const folders = await prisma.libraryFolder.findMany({ where: { courseId: folder.courseId }, select: { id: true, courseId: true, parentId: true, name: true, sortOrder: true, isVisible: true } });
    const subtreeIds = libraryFolderDescendantIds(folders, folder.id);
    if (!subtreeIds) throw new LibraryValidationError("تعذر قراءة بنية المجلد.");
    const files = await prisma.libraryFile.findMany({ where: { folderId: { in: subtreeIds } }, select: { storageKey: true } });
    await deleteLibraryFiles(files.map((file) => file.storageKey));
    await prisma.libraryFolder.delete({ where: { id: folder.id } }); refresh();
  } catch { back(data, "error", "تعذر حذف المجلد وملفاته."); }
  const parentId = text(data, "parentId");
  if (parentId) data.set("folder", parentId); else data.delete("folder");
  back(data, "success", "تم حذف المجلد.");
}

export async function updateFileTitleAction(data: FormData) {
  try {
    const file = await requireLibraryFile(text(data, "fileId")); if (!file) throw new LibraryValidationError("الملف غير موجود.");
    await prisma.libraryFile.update({ where: { id: file.id }, data: { title: validateLibraryFileTitle(data.get("title")) } }); refresh();
  } catch (error) { back(data, "error", message(error)); }
  back(data, "success", "تم تحديث اسم الملف.");
}

export async function deleteFileAction(data: FormData) {
  try {
    const file = await requireLibraryFile(text(data, "fileId")); if (!file) throw new LibraryValidationError("الملف غير موجود.");
    await deleteLibraryFiles([file.storageKey]);
    await prisma.libraryFile.delete({ where: { id: file.id } }); refresh();
  } catch { back(data, "error", "تعذر حذف الملف."); }
  back(data, "success", "تم حذف الملف.");
}

export async function createLinkAction(data: FormData) {
  try {
    const folder = await requireLibraryFolder(text(data, "folderId"));
    if (!folder) throw new LibraryValidationError("المجلد غير موجود.");
    const input = validateLibraryLinkInput(Object.fromEntries(data));
    const last = await prisma.libraryLink.aggregate({ where: { folderId: folder.id }, _max: { sortOrder: true } });
    await prisma.libraryLink.create({ data: { folderId: folder.id, ...input, sortOrder: (last._max.sortOrder ?? -1) + 1 } });
    refresh();
  } catch (error) { back(data, "error", message(error)); }
  back(data, "success", "تمت إضافة الرابط.");
}

export async function updateLinkAction(data: FormData) {
  try {
    const link = await requireLibraryLink(text(data, "linkId"));
    if (!link) throw new LibraryValidationError("الرابط غير موجود.");
    const input = validateLibraryLinkInput(Object.fromEntries(data));
    await prisma.libraryLink.update({ where: { id: link.id }, data: input });
    refresh();
  } catch (error) { back(data, "error", message(error)); }
  back(data, "success", "تم تحديث الرابط.");
}

export async function deleteLinkAction(data: FormData) {
  try {
    const link = await requireLibraryLink(text(data, "linkId"));
    if (!link) throw new LibraryValidationError("الرابط غير موجود.");
    await prisma.libraryLink.delete({ where: { id: link.id } });
    refresh();
  } catch (error) { back(data, "error", message(error)); }
  back(data, "success", "تم حذف الرابط.");
}

async function move(data: FormData, kind: "folder" | "file" | "link") {
  const direction = text(data, "direction");
  if (direction !== "up" && direction !== "down") throw new LibraryValidationError("اتجاه الترتيب غير صالح.");
  if (kind === "folder") {
    const folder = await requireLibraryFolder(text(data, "folderId")); if (!folder) throw new LibraryValidationError("المجلد غير موجود.");
    await prisma.$transaction(async (tx) => {
      const siblings = await tx.libraryFolder.findMany({ where: { courseId: folder.courseId, parentId: folder.parentId }, select: { id: true, sortOrder: true, createdAt: true } });
      const change = libraryAdjacentSwap(siblings, folder.id, direction);
      for (const item of change.normalized) await tx.libraryFolder.update({ where: { id: item.id }, data: { sortOrder: item.sortOrder } });
      for (const item of change.swap) await tx.libraryFolder.update({ where: { id: item.id }, data: { sortOrder: item.sortOrder } });
    });
  } else if (kind === "file") {
    const file = await requireLibraryFile(text(data, "fileId")); if (!file) throw new LibraryValidationError("الملف غير موجود.");
    const record = await prisma.libraryFile.findUnique({ where: { id: file.id }, select: { folderId: true } }); if (!record) throw new LibraryValidationError("الملف غير موجود.");
    await prisma.$transaction(async (tx) => {
      const siblings = await tx.libraryFile.findMany({ where: { folderId: record.folderId }, select: { id: true, sortOrder: true, createdAt: true } });
      const change = libraryAdjacentSwap(siblings, file.id, direction);
      for (const item of change.normalized) await tx.libraryFile.update({ where: { id: item.id }, data: { sortOrder: item.sortOrder } });
      for (const item of change.swap) await tx.libraryFile.update({ where: { id: item.id }, data: { sortOrder: item.sortOrder } });
    });
  } else {
    const link = await requireLibraryLink(text(data, "linkId")); if (!link) throw new LibraryValidationError("الرابط غير موجود.");
    const record = await prisma.libraryLink.findUnique({ where: { id: link.id }, select: { folderId: true } }); if (!record) throw new LibraryValidationError("الرابط غير موجود.");
    await prisma.$transaction(async (tx) => {
      const siblings = await tx.libraryLink.findMany({ where: { folderId: record.folderId }, select: { id: true, sortOrder: true, createdAt: true } });
      const change = libraryAdjacentSwap(siblings, link.id, direction);
      for (const item of change.normalized) await tx.libraryLink.update({ where: { id: item.id }, data: { sortOrder: item.sortOrder } });
      for (const item of change.swap) await tx.libraryLink.update({ where: { id: item.id }, data: { sortOrder: item.sortOrder } });
    });
  }
  refresh();
}

export async function moveFolderAction(data: FormData) {
  try { await move(data, "folder"); } catch (error) { back(data, "error", message(error)); }
  back(data, "success", "تم تحديث ترتيب المجلد.");
}

export async function moveFileAction(data: FormData) {
  try { await move(data, "file"); } catch (error) { back(data, "error", message(error)); }
  back(data, "success", "تم تحديث ترتيب الملف.");
}

export async function moveLinkAction(data: FormData) {
  try { await move(data, "link"); } catch (error) { back(data, "error", message(error)); }
  back(data, "success", "تم تحديث ترتيب الرابط.");
}
