import {
  readFile,
} from "node:fs/promises";
import path from "node:path";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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
  const { id } = await params;

  const user = await prisma.user.findFirst({
    where: {
      id,
      role: {
        in: ["MEMBER", "ADMIN"],
      },
      structureItem: {
        isNot: null,
      },
    },
    select: {
      avatarStoredName: true,
      avatarMime: true,
    },
  });

  if (
    !user?.avatarStoredName ||
    !user.avatarMime
  ) {
    return new Response("Not found", {
      status: 404,
    });
  }

  try {
    const file = await readFile(
      path.join(
        process.cwd(),
        "storage",
        "avatars",
        path.basename(
          user.avatarStoredName,
        ),
      ),
    );

    return new Response(file, {
      headers: {
        "Content-Type": user.avatarMime,
        "Cache-Control":
          "public, max-age=3600",
      },
    });
  } catch {
    return new Response("Not found", {
      status: 404,
    });
  }
}
