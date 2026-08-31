import { getCurrentUser } from "@/lib/auth";
import { logPrivateBlobReadError } from "@/lib/blob-storage";
import { prisma } from "@/lib/prisma";
import { resolveMemberMediaAccess } from "@/lib/user-media-access";
import {
  userImageErrorResponse,
  userImageResponse,
} from "@/lib/user-media-response";

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

  // لا نشترط وجود العضو داخل الهيكلية هنا؛ صفحة الملف الشخصي
  // تحتاج عرض الغلاف مباشرة بعد الحفظ حتى لو لم يكن للعضو StructureItem.
  const user = await prisma.user.findFirst({
    where: {
      id,
      role: {
        in: ["MEMBER", "ADMIN"],
      },
    },
    select: {
      profileCoverStoredName: true,
      profileCoverMime: true,
      structureItem: { select: { id: true } },
    },
  });

  if (!user?.profileCoverStoredName || !user.profileCoverMime) {
    return new Response("Not found", { status: 404 });
  }

  const viewer = user.structureItem ? null : (await getCurrentUser())?.user ?? null;
  const access = resolveMemberMediaAccess({
    targetUserId: id,
    isPublished: Boolean(user.structureItem),
    viewer,
  });

  if (!access) {
    return new Response("Not found", { status: 404 });
  }

  try {
    return (
      (await userImageResponse({
        storedName: user.profileCoverStoredName,
        mime: user.profileCoverMime,
        legacyFolder: "member-covers",
        cacheControl: access.cacheControl,
      })) ?? new Response("Not found", { status: 404 })
    );
  } catch (error) {
    logPrivateBlobReadError({
      route: "/members/[id]/cover",
      pathname: user.profileCoverStoredName,
      error,
    });
    return userImageErrorResponse(error);
  }
}
