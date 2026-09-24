import path from "node:path";
import { randomUUID } from "node:crypto";

import { normalizeMime, sanitizeOriginalFilename, UploadValidationError, validateAndProcessImage } from "@/lib/upload-security";
import { LIBRARY_MAX_FILE_BYTES } from "./constants";

const RULES = new Map([
  ["application/pdf", { extensions: [".pdf"], canonical: ".pdf", marker: "%PDF-" }],
  ["application/zip", { extensions: [".zip"], canonical: ".zip", marker: null }],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", { extensions: [".docx"], canonical: ".docx", marker: "word/document.xml" }],
  ["application/vnd.openxmlformats-officedocument.presentationml.presentation", { extensions: [".pptx"], canonical: ".pptx", marker: "ppt/presentation.xml" }],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", { extensions: [".xlsx"], canonical: ".xlsx", marker: "xl/workbook.xml" }],
]);

export type ValidatedLibraryFile = {
  buffer: Buffer;
  mime: string;
  extension: string;
  originalName: string;
  title: string;
  size: number;
  storageKey: string;
};

function validZip(buffer: Buffer) {
  return buffer.length >= 22 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer.includes(Buffer.from("PK\x05\x06", "binary"));
}

export async function validateLibraryUpload(file: File): Promise<ValidatedLibraryFile> {
  if (!(file instanceof File) || file.size === 0) throw new UploadValidationError("اختر ملفًا صالحًا.", "EMPTY");
  if (file.size > LIBRARY_MAX_FILE_BYTES) throw new UploadValidationError("حجم الملف أكبر من 25MB.", "SIZE");
  const mime = normalizeMime(file.type);
  const extension = path.extname(file.name).toLowerCase();
  if (["image/jpeg", "image/png", "image/webp"].includes(mime)) {
    const image = await validateAndProcessImage(file, { maxBytes: LIBRARY_MAX_FILE_BYTES, maxWidth: 8000, maxHeight: 8000, maxPixels: 32_000_000 });
    return { ...image, title: path.basename(image.originalName, path.extname(image.originalName)), storageKey: `library/${randomUUID()}${image.extension}` };
  }
  const rule = RULES.get(mime);
  if (!rule) throw new UploadValidationError("نوع الملف غير مسموح.", "TYPE");
  if (!rule.extensions.includes(extension)) throw new UploadValidationError("امتداد الملف لا يطابق نوعه.", "EXTENSION");
  const buffer = Buffer.from(await file.arrayBuffer());
  if (mime === "application/pdf") {
    if (!buffer.subarray(0, 5).equals(Buffer.from(rule.marker!)) || !buffer.subarray(-2048).includes(Buffer.from("%%EOF"))) throw new UploadValidationError("ملف PDF غير صالح.", "SIGNATURE");
  } else {
    if (!validZip(buffer)) throw new UploadValidationError("ملف ZIP غير صالح.", "SIGNATURE");
    if (rule.marker && !buffer.toString("latin1").includes(rule.marker)) throw new UploadValidationError("محتوى ملف Office غير صالح.", "SIGNATURE");
  }
  const originalName = sanitizeOriginalFilename(file.name);
  return { buffer, mime, extension: rule.canonical, originalName, title: path.basename(originalName, extension), size: buffer.length, storageKey: `library/${randomUUID()}${rule.canonical}` };
}

