"use server";

import {
  mkdir,
  unlink,
  writeFile,
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  PERMISSIONS,
  requirePermission,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const MAX_COVER_SIZE = 8 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

function fail(message: string): never {
  redirect(
    `/member/profile?error=${encodeURIComponent(message)}`,
  );
}

function validImageSignature(
  bytes: Uint8Array,
  mime: string,
) {
  if (mime === "image/jpeg") {
    return (
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
    );
  }

  if (mime === "image/png") {
    return (
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }

  if (mime === "image/webp") {
    return (
      bytes.length >= 12 &&
      String.fromCharCode(
        ...bytes.slice(0, 4),
      ) === "RIFF" &&
      String.fromCharCode(
        ...bytes.slice(8, 12),
      ) === "WEBP"
    );
  }

  return false;
}

async function saveImage(
  file: File,
  folder: "avatars" | "member-covers",
  maxSize: number,
) {
  if (file.size > maxSize) {
    fail(
      folder === "avatars"
        ? "حجم الصورة الشخصية يجب ألا يتجاوز 5MB."
        : "حجم صورة الغلاف يجب ألا يتجاوز 8MB.",
    );
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    fail("الصيغ المسموحة للصور هي JPG وPNG وWebP فقط.");
  }

  const buffer = Buffer.from(
    await file.arrayBuffer(),
  );

  if (
    !validImageSignature(
      new Uint8Array(buffer),
      file.type,
    )
  ) {
    fail("الملف المرفوع لا يبدو كصورة صالحة.");
  }

  const storedName =
    `${randomUUID()}${EXTENSIONS[file.type]}`;

  const directory = path.join(
    process.cwd(),
    "storage",
    folder,
  );

  await mkdir(directory, {
    recursive: true,
  });

  await writeFile(
    path.join(directory, storedName),
    buffer,
    { flag: "wx" },
  );

  return {
    storedName,
    originalName: file.name.slice(0, 255),
    mime: file.type,
    size: file.size,
  };
}

async function safeDelete(
  folder: "avatars" | "member-covers",
  storedName: string | null,
) {
  if (!storedName) return;

  try {
    await unlink(
      path.join(
        process.cwd(),
        "storage",
        folder,
        path.basename(storedName),
      ),
    );
  } catch {
    // Missing old file must not fail profile update.
  }
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

  if (
    avatarEntry instanceof File &&
    avatarEntry.size > 0
  ) {
    newAvatar = await saveImage(
      avatarEntry,
      "avatars",
      MAX_AVATAR_SIZE,
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
    );
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
