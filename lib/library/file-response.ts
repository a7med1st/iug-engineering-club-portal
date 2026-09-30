const PREVIEWABLE_LIBRARY_MIMES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function isPreviewableLibraryMime(mime: string) {
  return PREVIEWABLE_LIBRARY_MIMES.has(mime);
}
