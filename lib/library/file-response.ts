import { BlobStorageConfigurationError, logPrivateBlobReadError } from "@/lib/blob-storage";
import { privateFileResponse } from "@/lib/private-file-response";
import { readLibraryFile } from "./storage";

const PREVIEWABLE_LIBRARY_MIMES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function isPreviewableLibraryMime(mime: string) {
  return PREVIEWABLE_LIBRARY_MIMES.has(mime);
}
export async function libraryDownloadResponse(request: Request, file: {
  storageKey: string;
  mimeType: string;
  originalName: string;
  title: string;
}) {
  try {
    const stored = await readLibraryFile(file.storageKey);
    if (!stored?.stream || stored.statusCode !== 200) {
      return new Response(null, { status: 404, headers: { "cache-control": "private, no-store" } });
    }

    const headers = new Headers(Object.fromEntries(stored.headers.entries()));
    // Fetch decodes compressed bodies but retains the upstream encoded length.
    if (headers.has("content-encoding")) headers.delete("content-length");
    const mime = stored.blob.contentType && stored.blob.contentType !== "application/octet-stream"
      ? stored.blob.contentType : file.mimeType;
    const download = new URL(request.url).searchParams.get("download") === "1";
    return privateFileResponse({ ...stored, headers }, {
      fallbackMime: file.mimeType,
      originalName: file.originalName || file.title,
      disposition: isPreviewableLibraryMime(mime) && !download ? "inline" : "attachment",
      cacheControl: "private, no-store",
    }) ?? new Response(null, { status: 404, headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    const status = error instanceof BlobStorageConfigurationError ? 503 : 502;
    logPrivateBlobReadError({
      route: new URL(request.url).pathname,
      pathname: file.storageKey,
      error,
      status,
    });
    return Response.json({ error: "تعذر تنزيل الملف من التخزين. حاول مرة أخرى." }, {
      status,
      headers: { "cache-control": "private, no-store" },
    });
  }
}
