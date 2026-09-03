import {
  readFile,
} from "fs/promises";

import path from "path";

import {
  getPrivateBlob,
  logPrivateBlobReadError,
} from "@/lib/blob-storage";
import {
  hasGlobalContactAccess,
  requireContactAccess,
} from "@/lib/permissions";
import {
  privateFileResponse,
  safeContentDisposition,
} from "@/lib/private-file-response";

import { prisma } from "@/lib/prisma";

export const runtime =
  "nodejs";

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  const { user } = await requireContactAccess();

  const { id } =
    await params;

  const request =
    await prisma.collaborationRequest.findFirst({
      where: {
        id,
        ...(hasGlobalContactAccess(user)
          ? {}
          : { assignedToId: user.id }),
      },
    });

  if (
    !request ||
    !request.attachmentStoredName ||
    !request.attachmentOriginalName
  ) {
    return new Response(
      "File not found",
      {
        status: 404,
      },
    );
  }

  const filePath =
    path.join(
      process.cwd(),
      "storage",
      "collaboration",
      path.basename(request.attachmentStoredName),
    );

  const responseHeaders = {
    "Content-Type":
      request.attachmentMime ||
      "application/octet-stream",
    "Content-Disposition":
      safeContentDisposition(request.attachmentOriginalName, "attachment"),
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };

  if (request.attachmentStoredName.startsWith("collaboration/")) {
    try {
      const blob = await getPrivateBlob(request.attachmentStoredName);
      return (
        privateFileResponse(blob, {
          fallbackMime: request.attachmentMime || "application/octet-stream",
          originalName: request.attachmentOriginalName,
          disposition: "attachment",
          cacheControl: "private, no-store",
        }) ?? new Response("File not found", { status: 404 })
      );
    } catch (error) {
      logPrivateBlobReadError({
        route: "/admin/contact/files/[id]",
        pathname: request.attachmentStoredName,
        error,
      });
      return new Response("File unavailable", { status: 500 });
    }
  }

  // Read-only compatibility for files created before the Blob migration.
  try {
    const file =
      await readFile(
        filePath,
      );

    return new Response(
      file,
      {
        headers: responseHeaders,
      },
    );
  } catch {
    return new Response(
      "File not found",
      {
        status: 404,
      },
    );
  }
}
