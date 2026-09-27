import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { managedDepartmentIdsForUser } from "@/lib/permissions";
import { LIBRARY_MAX_FILE_BYTES, LIBRARY_MAX_FILES } from "@/lib/library/constants";
import { validateLibraryUpload } from "@/lib/library/file-validation";
import { deleteLibraryFiles, storeLibraryFile } from "@/lib/library/storage";
import { UploadValidationError, logUploadRejection } from "@/lib/upload-security";

export async function POST(request: Request) {
  const auth = await getCurrentUser();
  if (!auth || auth.user.role !== "MEMBER") return NextResponse.json({ error: "غير مصرح." }, { status: 401 });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > LIBRARY_MAX_FILES * LIBRARY_MAX_FILE_BYTES + 2 * 1024 * 1024) {
    return NextResponse.json({ error: "حجم طلب الرفع أكبر من الحد المسموح." }, { status: 413 });
  }
  const form = await request.formData();
  const folderId = String(form.get("folderId") ?? "");
  const departmentIds = managedDepartmentIdsForUser(auth.user);
  const folder = departmentIds.length ? await prisma.libraryFolder.findFirst({
    where: { id: folderId, isVisible: true, course: { departmentId: { in: departmentIds } } },
    select: { id: true },
  }) : null;
  if (!folder) return NextResponse.json({ error: "المجلد غير موجود." }, { status: 404 });

  const files = form.getAll("files").filter((item): item is File => item instanceof File);
  if (!files.length || files.length > LIBRARY_MAX_FILES) return NextResponse.json({ error: "اختر من ملف واحد إلى 10 ملفات." }, { status: 400 });
  const results: Array<{ name: string; ok: boolean; message?: string }> = [];
  for (const file of files) {
    let storedKey: string | null = null;
    try {
      const validated = await validateLibraryUpload(file);
      storedKey = await storeLibraryFile(validated);
      await prisma.libraryFile.create({ data: { folderId: folder.id, title: validated.title, originalName: validated.originalName, storageKey: validated.storageKey, mimeType: validated.mime, size: validated.size, uploadedById: auth.user.id } });
      results.push({ name: file.name, ok: true });
    } catch (error) {
      if (storedKey) await deleteLibraryFiles([storedKey]).catch(() => undefined);
      logUploadRejection("library", error, { size: file.size, mime: file.type });
      results.push({ name: file.name, ok: false, message: error instanceof UploadValidationError ? error.message : "تعذر رفع الملف." });
    }
  }
  return NextResponse.json({ results });
}
