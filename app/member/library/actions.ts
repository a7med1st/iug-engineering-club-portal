"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireMemberLibraryCourse, requireMemberLibraryFolder } from "@/lib/library/member";
import { LibraryValidationError, validateLibraryFolderInput, validateLibraryLinkInput } from "@/lib/library/validation";

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
    const folder = await prisma.libraryFolder.create({ data: { courseId: course.id, parentId, createdById: user.id, ...input } });
    refresh(course.id, folder.id);
    back(course.id, folder.id, "success", "تمت إضافة المجلد.");
  } catch (error) {
    if (error instanceof LibraryValidationError) back(course.id, null, "error", error.message);
    throw error;
  }
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
