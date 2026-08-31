import type { GetBlobResult } from "@vercel/blob";
import type { StoredFileResult } from "@/lib/blob-storage";

const MIME_PATTERN = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i;

const INLINE_MIME_PATTERN =
  /^(image\/(jpeg|png|gif|webp)|audio\/(mpeg|mp4|ogg|wav|webm)|video\/(mp4|webm|ogg))$/i;

export function safeContentDisposition(
  originalName: string,
  mode: "inline" | "attachment",
) {
  const asciiName =
    originalName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180) || "file";
  const encodedName = encodeURIComponent(originalName)
    .replace(/['()*]/g, (character) =>
      `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
    );

  return `${mode}; filename="${asciiName}"; filename*=UTF-8''${encodedName}`;
}

export function isSafeInlineMime(mime: string) {
  return INLINE_MIME_PATTERN.test(mime);
}

function resolvedMime(blobMime: string | null, fallbackMime: string) {
  if (
    blobMime &&
    blobMime !== "application/octet-stream" &&
    MIME_PATTERN.test(blobMime)
  ) {
    return blobMime;
  }
  if (MIME_PATTERN.test(fallbackMime)) return fallbackMime;
  return "application/octet-stream";
}

export function privateFileResponse(
  result: GetBlobResult | StoredFileResult | null,
  options: {
    fallbackMime: string;
    originalName: string;
    disposition?: "inline" | "attachment" | "auto";
    cacheControl: string;
  },
) {
  if (!result || result.statusCode !== 200 || !result.stream) return null;

  const mime = resolvedMime(result.blob.contentType, options.fallbackMime);
  const disposition =
    options.disposition === "auto"
      ? isSafeInlineMime(mime)
        ? "inline"
        : "attachment"
      : (options.disposition ?? "attachment");
  const headers = new Headers({
    "Content-Type": mime,
    "Content-Disposition": safeContentDisposition(
      options.originalName,
      disposition,
    ),
    "Cache-Control": options.cacheControl,
    "X-Content-Type-Options": "nosniff",
  });

  for (const name of ["content-length", "etag", "last-modified"] as const) {
    const value = result.headers.get(name);
    if (value) headers.set(name, value);
  }

  return new Response(result.stream, { status: 200, headers });
}
