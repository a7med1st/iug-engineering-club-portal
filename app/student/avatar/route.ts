import {
  readFile,
} from "node:fs/promises";
import path from "node:path";

import {
  PERMISSIONS,
  requirePermission,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const { user: currentUser } =
    await requirePermission(
      PERMISSIONS.STUDENT_DASHBOARD,
    );

  const user =
    await prisma.user.findUnique({
      where: {
        id: currentUser.id,
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
    return new Response(
      "Avatar not found",
      {
        status: 404,
      },
    );
  }

  const safeName =
    path.basename(
      user.avatarStoredName,
    );

  try {
    const file =
      await readFile(
        path.join(
          process.cwd(),
          "storage",
          "avatars",
          safeName,
        ),
      );

    return new Response(file, {
      status: 200,

      headers: {
        "Content-Type":
          user.avatarMime,

        "Content-Disposition":
          'inline; filename="avatar"',

        "Cache-Control":
          "private, no-store",
      },
    });
  } catch {
    return new Response(
      "Avatar not found",
      {
        status: 404,
      },
    );
  }
}