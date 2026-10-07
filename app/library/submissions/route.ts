import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LIBRARY_MAX_FILE_BYTES } from "@/lib/library/constants";
import { validateLibraryUpload } from "@/lib/library/file-validation";
import { deleteLibraryFiles, storeLibraryFile } from "@/lib/library/storage";
import { validateLibrarySubmissionTitle } from "@/lib/library/submissions";
import { enforceLibrarySubmissionUploadLimit, UploadRateLimitError, uploadRateLimitMessage } from "@/lib/upload-rate-limit";
import { UploadValidationError, logUploadRejection } from "@/lib/upload-security";

export async function POST(request: Request) {
  const auth = await getCurrentUser();
  if (!auth || auth.user.role !== "STUDENT") return NextResponse.json({ error: "غير مصرح." }, { status: 401 });
  if (!auth.user.departmentId) return NextResponse.json({ error: "أضف تخصصك إلى حسابك أولًا." }, { status: 400 });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > LIBRARY_MAX_FILE_BYTES + 1024 * 1024) return NextResponse.json({ error: "حجم الملف أكبر من الحد المسموح." }, { status: 413 });
  let storageKey: string | null = null;
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "اختر ملفًا أولًا." }, { status: 400 });
    const title = validateLibrarySubmissionTitle(form.get("title"));
    const note = String(form.get("note") ?? "").trim();
    if (note.length > 500) return NextResponse.json({ error: "الملاحظة طويلة جدًا." }, { status: 400 });
    await enforceLibrarySubmissionUploadLimit(auth.user.id, file.size);
    const validated = await validateLibraryUpload(file);
    storageKey = await storeLibraryFile(validated);
    await prisma.librarySubmission.create({ data: {
      departmentId: auth.user.departmentId,
      studentId: auth.user.id,
      title,
      note: note || null,
      originalName: validated.originalName,
      storageKey,
      mimeType: validated.mime,
      size: validated.size,
    } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (storageKey) await deleteLibraryFiles([storageKey]).catch(() => undefined);
    logUploadRejection("library-submission", error);
    const message = error instanceof UploadRateLimitError ? uploadRateLimitMessage(error) :
      error instanceof UploadValidationError || error instanceof Error && error.message.startsWith("اكتب عنوانًا") ? error.message : "تعذر إرسال الملف.";
    return NextResponse.json({ error: message }, { status: error instanceof UploadRateLimitError ? 429 : 400 });
  }
}
