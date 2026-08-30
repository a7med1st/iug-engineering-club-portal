import { readFile } from "node:fs/promises";
import path from "node:path";

import { getPrivateBlob } from "@/lib/blob-storage";
import { privateFileResponse } from "@/lib/private-file-response";

export async function userImageResponse(options: {
  storedName: string;
  mime: string;
  legacyFolder: "avatars" | "member-covers";
  cacheControl: string;
}) {
  const headers = {
    "Content-Type": options.mime,
    "Content-Disposition": 'inline; filename="image"',
    "Cache-Control": options.cacheControl,
    "X-Content-Type-Options": "nosniff",
  };

  if (options.storedName.startsWith("user-media/")) {
    const blob = await getPrivateBlob(options.storedName, {
      abortSignal: AbortSignal.timeout(15_000),
      useCache: false,
    });
    return privateFileResponse(blob, {
      fallbackMime: options.mime,
      originalName: "image",
      disposition: "inline",
      cacheControl: options.cacheControl,
    });
  }

  // Read-only compatibility for files created before the Blob migration.
  const safeName = path.basename(options.storedName);
  try {
    const file = await readFile(
      path.join(process.cwd(), "storage", options.legacyFolder, safeName),
    );
    return new Response(file, { headers });
  } catch {
    return null;
  }
}
