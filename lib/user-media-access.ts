import type { Role } from "@prisma/client";

export const PUBLIC_USER_MEDIA_CACHE = "public, max-age=3600";
export const PRIVATE_USER_MEDIA_CACHE = "private, no-store";

export function resolveMemberMediaAccess(options: {
  targetUserId: string;
  isPublished: boolean;
  viewer: { id: string; role: Role } | null;
}) {
  if (options.isPublished) {
    return { cacheControl: PUBLIC_USER_MEDIA_CACHE };
  }

  if (
    options.viewer &&
    (options.viewer.id === options.targetUserId || options.viewer.role === "ADMIN")
  ) {
    return { cacheControl: PRIVATE_USER_MEDIA_CACHE };
  }

  return null;
}
