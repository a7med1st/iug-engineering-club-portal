export class LibraryValidationError extends Error {}

function requiredText(value: unknown, label: string, max: number) {
  const text = String(value ?? "").trim();
  if (!text) throw new LibraryValidationError(`${label} مطلوب.`);
  if (text.length > max) throw new LibraryValidationError(`${label} أطول من الحد المسموح.`);
  return text;
}

function optionalText(value: unknown, max: number) {
  const text = String(value ?? "").trim();
  if (text.length > max) throw new LibraryValidationError("النص أطول من الحد المسموح.");
  return text || null;
}

function integer(value: unknown, label: string, min = 0, max = 100000) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new LibraryValidationError(`${label} غير صالح.`);
  }
  return parsed;
}

export function validateLibraryCourseInput(input: Record<string, unknown>) {
  return {
    level: integer(input.level, "المستوى", 1, 5),
    name: requiredText(input.name, "اسم المساق", 120),
    code: optionalText(input.code, 40),
    description: optionalText(input.description, 500),
    sortOrder: integer(input.sortOrder ?? 0, "الترتيب"),
  };
}

export function validateLibraryFolderInput(input: Record<string, unknown>) {
  return {
    name: requiredText(input.name, "اسم المجلد", 120),
    sortOrder: integer(input.sortOrder ?? 0, "الترتيب"),
    isVisible: input.isVisible === true || input.isVisible === "on" || input.isVisible === "true",
  };
}

export function validateLibraryFileTitle(value: unknown) {
  return requiredText(value, "اسم الملف", 180);
}

export function validateLibraryLinkInput(input: Record<string, unknown>) {
  const title = requiredText(input.title, "عنوان الرابط", 180);
  const rawUrl = requiredText(input.url, "الرابط", 2048);
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new LibraryValidationError("الرابط غير صالح.");
  }
  if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password) {
    throw new LibraryValidationError("استخدم رابط http أو https صالحاً.");
  }
  return { title, url: url.toString() };
}

