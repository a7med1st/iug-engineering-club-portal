export function normalizeLibraryCourseCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/[\s\u00a0_-]+/gu, "").toUpperCase();
  return normalized || null;
}
