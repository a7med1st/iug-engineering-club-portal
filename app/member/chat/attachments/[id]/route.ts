import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { authorizeApiPermission } from "@/lib/api-auth";
import {
  getPrivateBlob,
  isVercelBlobUrl,
  logPrivateBlobReadError,
} from "@/lib/blob-storage";
import { PERMISSIONS } from "@/lib/permissions";
import {
  isSafeInlineMime,
  privateFileResponse,
  safeContentDisposition,
} from "@/lib/private-file-response";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function contentDisposition(name: string, mime: string) {
  return safeContentDisposition(
    name,
    isSafeInlineMime(mime) ? "inline" : "attachment",
  );
}

function responseHeaders(
  mime: string,
  name: string,
  length: number,
  extra?: Record<string, string>,
) {
  return {
    "Content-Type": mime,
    "Content-Length": String(length),
    "Content-Disposition": contentDisposition(name, mime),
    "Cache-Control": "private, max-age=3600",
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
    ...extra,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeApiPermission(PERMISSIONS.MEMBER_DASHBOARD);
  if (!auth.authorized) return auth.response;

  const { id } = await params;
  const attachment = await prisma.chatAttachment.findFirst({
    where: {
      id,
      message: {
        conversation: {
          participants: { some: { userId: auth.user.id } },
        },
      },
    },
    select: {
      url: true,
      pathname: true,
      originalName: true,
      mime: true,
      size: true,
    },
  });

  if (!attachment) return new NextResponse("Not found", { status: 404 });

  const range = request.headers.get("range");

  if (attachment.url) {
    if (!isVercelBlobUrl(attachment.url)) {
      return new NextResponse("File unavailable", { status: 502 });
    }

    if (new URL(attachment.url).hostname.includes(".private.")) {
      try {
        // Resolve by pathname so the configured private storeId, rather than a
        // provider URL persisted by the legacy model, selects the store.
        const privateBlob = await getPrivateBlob(attachment.pathname);
        return (
          privateFileResponse(privateBlob, {
            fallbackMime: attachment.mime,
            originalName: attachment.originalName,
            disposition: "auto",
            cacheControl: "private, no-store",
          }) ?? new NextResponse("Not found", { status: 404 })
        );
      } catch (error) {
        logPrivateBlobReadError({
          route: "/member/chat/attachments/[id]",
          pathname: attachment.pathname,
          error,
        });
        return new NextResponse("File unavailable", { status: 500 });
      }
    }

    // Backward-compatible read path for legacy public chat blobs. New uploads
    // never persist or expose a provider URL.
    const upstream = await fetch(attachment.url, {
      headers: range ? { Range: range } : undefined,
      cache: "no-store",
    });

    if (!upstream.ok && upstream.status !== 206) {
      return new NextResponse("File unavailable", { status: 502 });
    }

    const headers = new Headers(upstream.headers);
    headers.set("Content-Type", attachment.mime);
    headers.set("Content-Disposition", contentDisposition(attachment.originalName, attachment.mime));
    headers.set("Cache-Control", "private, max-age=3600");
    headers.set("X-Content-Type-Options", "nosniff");
    return new NextResponse(upstream.body, { status: upstream.status, headers });
  }

  try {
    const privateBlob = await getPrivateBlob(attachment.pathname);
    const response = privateFileResponse(privateBlob, {
      fallbackMime: attachment.mime,
      originalName: attachment.originalName,
      disposition: "auto",
      cacheControl: "private, no-store",
    });
    if (response) return response;
  } catch (error) {
    // A storage/OIDC failure is not proof that this is a legacy local file.
    // Only a confirmed Blob 404 is allowed to proceed to the compatibility path.
    logPrivateBlobReadError({
      route: "/member/chat/attachments/[id]",
      pathname: attachment.pathname,
      error,
    });
    return new NextResponse("File unavailable", { status: 500 });
  }

  if (!attachment.pathname.startsWith("chat-attachments/")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const storageRoot = path.resolve(process.cwd(), "storage");
  const filePath = path.resolve(storageRoot, attachment.pathname);
  if (!filePath.startsWith(`${storageRoot}${path.sep}`)) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const fileStat = await stat(filePath);
    const total = fileStat.size;

    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(range);
      if (match) {
        const start = Number(match[1]);
        const end = match[2] ? Math.min(Number(match[2]), total - 1) : total - 1;

        if (start <= end && start < total) {
          const data = (await readFile(filePath)).subarray(start, end + 1);
          return new NextResponse(new Blob([new Uint8Array(data)]), {
            status: 206,
            headers: responseHeaders(attachment.mime, attachment.originalName, data.length, {
              "Content-Range": `bytes ${start}-${end}/${total}`,
            }),
          });
        }
      }

      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${total}` },
      });
    }

    const data = await readFile(filePath);
    return new NextResponse(new Blob([new Uint8Array(data)]), {
      headers: responseHeaders(attachment.mime, attachment.originalName, data.length),
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
