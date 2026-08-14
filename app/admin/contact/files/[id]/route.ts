import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  }
) {
  const session = await getSession();

  if (!session || session.role !== "ADMIN") {
    return new Response("Unauthorized", {
      status: 401,
    });
  }

  const { id } = await params;

  const request =
    await prisma.collaborationRequest.findUnique({
      where: { id },
    });

  if (
    !request ||
    !request.attachmentStoredName ||
    !request.attachmentOriginalName
  ) {
    return new Response("File not found", {
      status: 404,
    });
  }

  const filePath = path.join(
    process.cwd(),
    "storage",
    "collaboration",
    request.attachmentStoredName
  );

  try {
    const file = await readFile(filePath);

    return new Response(file, {
      headers: {
        "Content-Type":
          request.attachmentMime ||
          "application/octet-stream",

        "Content-Disposition":
          `attachment; filename*=UTF-8''${encodeURIComponent(
            request.attachmentOriginalName
          )}`,

        "Cache-Control":
          "private, no-store",
      },
    });
  } catch {
    return new Response("File not found", {
      status: 404,
    });
  }
}