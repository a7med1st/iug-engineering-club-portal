import {
  PERMISSIONS,
  requirePermission,
} from "@/lib/permissions";
import { logPrivateBlobReadError } from "@/lib/blob-storage";
import { prisma } from "@/lib/prisma";
import {
  userImageErrorResponse,
  userImageResponse,
} from "@/lib/user-media-response";

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

  try {
    return (
      (await userImageResponse({
        storedName: user.avatarStoredName,
        mime: user.avatarMime,
        legacyFolder: "avatars",
        cacheControl: "private, no-store",
      })) ?? new Response("Avatar not found", { status: 404 })
    );
  } catch (error) {
    logPrivateBlobReadError({
      route: "/student/avatar",
      pathname: user.avatarStoredName,
      error,
    });
    return userImageErrorResponse(error);
  }
}
