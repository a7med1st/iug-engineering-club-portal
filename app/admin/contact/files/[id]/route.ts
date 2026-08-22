import {
  readFile,
} from "fs/promises";

import path from "path";

import { requireContactAccess } from "@/lib/permissions";

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
        ...(user.role === "ADMIN"
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
      request.attachmentStoredName,
    );

  try {
    const file =
      await readFile(
        filePath,
      );

    return new Response(
      file,
      {
        headers: {
          "Content-Type":
            request.attachmentMime ||
            "application/octet-stream",

          "Content-Disposition":
            `attachment; filename*=UTF-8''${encodeURIComponent(
              request.attachmentOriginalName,
            )}`,

          "Cache-Control":
            "private, no-store",
        },
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
