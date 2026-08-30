import path from "node:path";

import sharp from "sharp";

export type UploadCategory = "image" | "audio" | "video" | "document";

export type ValidatedUpload = {
  buffer: Buffer;
  mime: string;
  extension: string;
  originalName: string;
  category: UploadCategory;
  size: number;
  width?: number;
  height?: number;
};

export type ImageValidationOptions = {
  maxBytes: number;
  maxWidth: number;
  maxHeight: number;
  maxPixels: number;
};

export class UploadValidationError extends Error {
  constructor(
    message: string,
    readonly code: "EMPTY" | "SIZE" | "TYPE" | "EXTENSION" | "SIGNATURE" | "DIMENSIONS",
  ) {
    super(message);
  }
}

const IMAGE_TYPES = new Map([
  ["image/jpeg", { extensions: new Set([".jpg", ".jpeg", ".jfif"]), extension: ".jpg" }],
  ["image/png", { extensions: new Set([".png"]), extension: ".png" }],
  ["image/webp", { extensions: new Set([".webp"]), extension: ".webp" }],
]);

const CHAT_BINARY_TYPES = new Map<
  string,
  { extensions: Set<string>; extension: string; category: Exclude<UploadCategory, "image"> }
>([
  ["audio/webm", { extensions: new Set([".webm"]), extension: ".webm", category: "audio" }],
  ["audio/ogg", { extensions: new Set([".ogg", ".oga"]), extension: ".ogg", category: "audio" }],
  ["audio/mp4", { extensions: new Set([".m4a", ".mp4"]), extension: ".m4a", category: "audio" }],
  ["audio/mpeg", { extensions: new Set([".mp3"]), extension: ".mp3", category: "audio" }],
  ["audio/wav", { extensions: new Set([".wav"]), extension: ".wav", category: "audio" }],
  ["video/webm", { extensions: new Set([".webm"]), extension: ".webm", category: "video" }],
  ["video/ogg", { extensions: new Set([".ogv", ".ogg"]), extension: ".ogv", category: "video" }],
  ["video/mp4", { extensions: new Set([".mp4", ".m4v"]), extension: ".mp4", category: "video" }],
  ["application/pdf", { extensions: new Set([".pdf"]), extension: ".pdf", category: "document" }],
  [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    { extensions: new Set([".docx"]), extension: ".docx", category: "document" },
  ],
]);

export function sanitizeOriginalFilename(name: string, fallback = "file") {
  const sanitized = name
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/\"']/g, "_")
    .trim()
    .slice(0, 180);

  return sanitized || fallback;
}

export function normalizeMime(value: string) {
  return value.split(";", 1)[0]?.trim().toLowerCase() || "application/octet-stream";
}

function fileExtension(file: File) {
  return path.extname(file.name).toLowerCase();
}

function assertBasicFile(file: File, maxBytes: number) {
  if (!(file instanceof File) || file.size === 0) {
    throw new UploadValidationError("اختر ملفًا صالحًا للرفع.", "EMPTY");
  }

  if (file.size > maxBytes) {
    throw new UploadValidationError("حجم الملف أكبر من الحد المسموح.", "SIZE");
  }
}

function matchesPdf(buffer: Buffer) {
  return (
    buffer.subarray(0, 5).toString("ascii") === "%PDF-" &&
    buffer.subarray(Math.max(0, buffer.length - 2048)).includes(Buffer.from("%%EOF"))
  );
}

function matchesDocx(buffer: Buffer) {
  if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) return false;

  const ascii = buffer.toString("latin1");
  return ascii.includes("[Content_Types].xml") && ascii.includes("word/document.xml");
}

function matchesMp4(buffer: Buffer) {
  return buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp";
}

function matchesWebm(buffer: Buffer) {
  return (
    buffer.length >= 4 &&
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  );
}

function matchesOgg(buffer: Buffer) {
  return buffer.subarray(0, 4).toString("ascii") === "OggS";
}

function matchesMp3(buffer: Buffer) {
  return (
    buffer.subarray(0, 3).toString("ascii") === "ID3" ||
    (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)
  );
}

function matchesWav(buffer: Buffer) {
  return (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WAVE"
  );
}

function matchesBinarySignature(mime: string, buffer: Buffer) {
  if (mime === "application/pdf") return matchesPdf(buffer);
  if (mime.includes("wordprocessingml")) return matchesDocx(buffer);
  if (mime === "audio/mp4" || mime === "video/mp4") return matchesMp4(buffer);
  if (mime === "audio/webm" || mime === "video/webm") return matchesWebm(buffer);
  if (mime === "audio/ogg" || mime === "video/ogg") return matchesOgg(buffer);
  if (mime === "audio/mpeg") return matchesMp3(buffer);
  if (mime === "audio/wav") return matchesWav(buffer);
  return false;
}

export async function validateAndProcessImage(
  file: File,
  options: ImageValidationOptions,
): Promise<ValidatedUpload> {
  assertBasicFile(file, options.maxBytes);

  const mime = normalizeMime(file.type);
  const rule = IMAGE_TYPES.get(mime);
  if (!rule) {
    throw new UploadValidationError("الصيغ المسموحة للصور هي JPEG وPNG وWebP فقط.", "TYPE");
  }

  if (!rule.extensions.has(fileExtension(file))) {
    throw new UploadValidationError("امتداد الصورة لا يطابق نوعها المعلن.", "EXTENSION");
  }

  const input = Buffer.from(await file.arrayBuffer());

  try {
    const pipeline = sharp(input, {
      failOn: "error",
      limitInputPixels: options.maxPixels,
      sequentialRead: true,
    });
    const metadata = await pipeline.metadata();

    if (
      !metadata.width ||
      !metadata.height ||
      metadata.width > options.maxWidth ||
      metadata.height > options.maxHeight ||
      metadata.width * metadata.height > options.maxPixels
    ) {
      throw new UploadValidationError("أبعاد الصورة أكبر من الحد المسموح.", "DIMENSIONS");
    }

    let outputPipeline = sharp(input, {
      failOn: "error",
      limitInputPixels: options.maxPixels,
      sequentialRead: true,
    }).rotate();

    if (mime === "image/jpeg") outputPipeline = outputPipeline.jpeg({ quality: 88, mozjpeg: true });
    if (mime === "image/png") outputPipeline = outputPipeline.png({ compressionLevel: 9 });
    if (mime === "image/webp") outputPipeline = outputPipeline.webp({ quality: 88 });

    const buffer = await outputPipeline.toBuffer();
    if (buffer.length > options.maxBytes) {
      throw new UploadValidationError("حجم الصورة بعد المعالجة أكبر من الحد المسموح.", "SIZE");
    }
    return {
      buffer,
      mime,
      extension: rule.extension,
      originalName: sanitizeOriginalFilename(file.name, `image${rule.extension}`),
      category: "image",
      size: buffer.length,
      width: metadata.width,
      height: metadata.height,
    };
  } catch (error) {
    if (error instanceof UploadValidationError) throw error;
    throw new UploadValidationError("محتوى الملف ليس صورة صالحة.", "SIGNATURE");
  }
}

export async function validateChatUpload(
  file: File,
  maxBytes: number,
): Promise<ValidatedUpload> {
  assertBasicFile(file, maxBytes);
  const mime = normalizeMime(file.type);

  if (IMAGE_TYPES.has(mime)) {
    return validateAndProcessImage(file, {
      maxBytes,
      maxWidth: 6_000,
      maxHeight: 6_000,
      maxPixels: 24_000_000,
    });
  }

  const rule = CHAT_BINARY_TYPES.get(mime);
  if (!rule) {
    throw new UploadValidationError("نوع الملف غير مسموح في المحادثة.", "TYPE");
  }

  if (!rule.extensions.has(fileExtension(file))) {
    throw new UploadValidationError("امتداد الملف لا يطابق نوعه.", "EXTENSION");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!matchesBinarySignature(mime, buffer)) {
    throw new UploadValidationError("محتوى الملف لا يطابق نوعه المعلن.", "SIGNATURE");
  }

  return {
    buffer,
    mime,
    extension: rule.extension,
    originalName: sanitizeOriginalFilename(file.name),
    category: rule.category,
    size: buffer.length,
  };
}

export async function validateCollaborationDocument(
  file: File,
  maxBytes: number,
): Promise<ValidatedUpload> {
  assertBasicFile(file, maxBytes);
  const mime = normalizeMime(file.type);
  const rule = CHAT_BINARY_TYPES.get(mime);

  if (!rule || rule.category !== "document" || !rule.extensions.has(fileExtension(file))) {
    throw new UploadValidationError("يسمح فقط بملفات PDF أو DOCX الصالحة.", "TYPE");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!matchesBinarySignature(mime, buffer)) {
    throw new UploadValidationError("محتوى المستند لا يطابق صيغته المعلنة.", "SIGNATURE");
  }

  return {
    buffer,
    mime,
    extension: rule.extension,
    originalName: sanitizeOriginalFilename(file.name),
    category: "document",
    size: buffer.length,
  };
}

export function logUploadRejection(
  context: string,
  error: unknown,
  details: { size?: number; mime?: string } = {},
) {
  console.warn("Upload rejected", {
    context,
    code: error instanceof UploadValidationError ? error.code : "UNKNOWN",
    size: details.size,
    mime: details.mime ? normalizeMime(details.mime) : undefined,
  });
}
