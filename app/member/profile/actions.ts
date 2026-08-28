"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  PERMISSIONS,
  requirePermission,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  UploadRateLimitError,
  enforceProfileUploadLimit,
  uploadRateLimitMessage,
} from "@/lib/upload-rate-limit";
import {
  UserMediaStorageError,
  tryDeleteUserImage,
  uploadUserImage,
} from "@/lib/user-media-storage";

const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const MAX_COVER_SIZE = 8 * 1024 * 1024;

function fail(message: string): never {
  redirect(
    `/member/profile?error=${encodeURIComponent(message)}`,
  );
}

async function saveImage(
  file: File,
  folder: "avatars" | "member-covers",
  maxSize: number,
  userId: string,
) {
  try {
    return await uploadUserImage(
      file,
      userId,
      folder === "avatars" ? "avatar" : "member-cover",
      maxSize,
    );
  } catch (error) {
    fail(
      error instanceof UserMediaStorageError
        ? error.message
        : "تعذر حفظ الصورة المرفوعة.",
    );
  }
}

async function safeDelete(
  folder: "avatars" | "member-covers",
  storedName: string | null,
) {
  await tryDeleteUserImage(storedName, folder, "member-profile");
}

function normalizeUrl(
  raw: FormDataEntryValue | null,
  label: string,
) {
  const value = String(raw ?? "").trim();

  if (!value) return null;

  try {
    const url = new URL(value);

    if (
      url.protocol !== "https:" &&
      url.protocol !== "http:"
    ) {
      fail(`${label}: الرابط يجب أن يبدأ بـ http أو https.`);
    }

    return url.toString();
  } catch {
    fail(`${label}: أدخل رابطًا صالحًا.`);
  }
}

export async function updateMemberProfile(
  formData: FormData,
) {
  const { user } = await requirePermission(
    PERMISSIONS.MEMBER_DASHBOARD,
  );

  const bio = String(
    formData.get("bio") ?? "",
  ).trim();

  if (bio.length > 1500) {
    fail("النبذة يجب ألا تتجاوز 1500 حرف.");
  }

  const skills = [
    ...new Set(
      String(formData.get("skills") ?? "")
        .split(/[\n،,]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];

  if (skills.length > 20) {
    fail("يمكن إضافة 20 مهارة كحد أقصى.");
  }

  if (skills.some((item) => item.length > 50)) {
    fail("كل مهارة يجب ألا تتجاوز 50 حرفًا.");
  }

  const linkedIn = normalizeUrl(
    formData.get("linkedIn"),
    "LinkedIn",
  );

  const github = normalizeUrl(
    formData.get("github"),
    "GitHub",
  );

  const instagram = normalizeUrl(
    formData.get("instagram"),
    "Instagram",
  );

  const current = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      avatarStoredName: true,
      profileCoverStoredName: true,
    },
  });

  if (!current) {
    fail("الحساب غير موجود.");
  }

  const avatarEntry = formData.get("avatar");
  const coverEntry = formData.get("cover");

  const removeAvatar =
    formData.get("removeAvatar") === "on";

  const removeCover =
    formData.get("removeCover") === "on";

  let newAvatar:
    | Awaited<ReturnType<typeof saveImage>>
    | null = null;

  let newCover:
    | Awaited<ReturnType<typeof saveImage>>
    | null = null;

  const uploadBytes =
    (avatarEntry instanceof File ? avatarEntry.size : 0) +
    (coverEntry instanceof File ? coverEntry.size : 0);

  if (uploadBytes > 0) {
    try {
      await enforceProfileUploadLimit(user.id, uploadBytes);
    } catch (error) {
      if (error instanceof UploadRateLimitError) fail(uploadRateLimitMessage(error));
      throw error;
    }
  }

  try {
    if (
      avatarEntry instanceof File &&
      avatarEntry.size > 0
    ) {
      newAvatar = await saveImage(
        avatarEntry,
        "avatars",
        MAX_AVATAR_SIZE,
        user.id,
      );
    }

    if (
      coverEntry instanceof File &&
      coverEntry.size > 0
    ) {
      newCover = await saveImage(
        coverEntry,
        "member-covers",
        MAX_COVER_SIZE,
        user.id,
      );
    }
  } catch (error) {
    if (newAvatar) await safeDelete("avatars", newAvatar.storedName);
    throw error;
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        profileBio: bio || null,
        profileSkills: skills,
        profileLinkedIn: linkedIn,
        profileGithub: github,
        profileInstagram: instagram,

        ...(newAvatar
          ? {
              avatarStoredName:
                newAvatar.storedName,
              avatarOriginalName:
                newAvatar.originalName,
              avatarMime: newAvatar.mime,
              avatarSize: newAvatar.size,
              avatarUpdatedAt: new Date(),
            }
          : removeAvatar
            ? {
                avatarStoredName: null,
                avatarOriginalName: null,
                avatarMime: null,
                avatarSize: null,
                avatarUpdatedAt: new Date(),
              }
            : {}),

        ...(newCover
          ? {
              profileCoverStoredName:
                newCover.storedName,
              profileCoverOriginalName:
                newCover.originalName,
              profileCoverMime:
                newCover.mime,
              profileCoverSize:
                newCover.size,
              profileCoverUpdatedAt:
                new Date(),
            }
          : removeCover
            ? {
                profileCoverStoredName: null,
                profileCoverOriginalName: null,
                profileCoverMime: null,
                profileCoverSize: null,
                profileCoverUpdatedAt:
                  new Date(),
              }
            : {}),
      },
    });
  } catch (error) {
    if (newAvatar) {
      await safeDelete(
        "avatars",
        newAvatar.storedName,
      );
    }

    if (newCover) {
      await safeDelete(
        "member-covers",
        newCover.storedName,
      );
    }

    throw error;
  }

  if (newAvatar || removeAvatar) {
    await safeDelete(
      "avatars",
      current.avatarStoredName,
    );
  }

  if (newCover || removeCover) {
    await safeDelete(
      "member-covers",
      current.profileCoverStoredName,
    );
  }

  revalidatePath("/member");
  revalidatePath("/member/profile");
  revalidatePath("/delegates");
  revalidatePath(`/members/${user.id}`);

  redirect(
    `/member/profile?success=${encodeURIComponent(
      "تم حفظ الملف الشخصي بنجاح.",
    )}`,
  );
}
