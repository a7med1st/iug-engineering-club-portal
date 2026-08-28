import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import path from "node:path";

import {
  deletePrivateBlobs,
  putPrivateBlob,
} from "@/lib/blob-storage";
import {
  UploadValidationError,
  validateAndProcessImage,
} from "@/lib/upload-security";

export type UserMediaKind = "avatar" | "member-cover";

export class UserMediaStorageError extends Error {}

export async function uploadUserImage(
  file: File,
  userId: string,
  kind: UserMediaKind,
  maxBytes: number,
) {
  let validated;

  try {
    validated = await validateAndProcessImage(file, {
      maxBytes,
      maxWidth: kind === "avatar" ? 4_096 : 6_000,
      maxHeight: kind === "avatar" ? 4_096 : 6_000,
      maxPixels: kind === "avatar" ? 12_000_000 : 24_000_000,
    });
  } catch (error) {
    throw new UserMediaStorageError(
      error instanceof UploadValidationError
        ? error.message
        : "تعذر التحقق من الصورة المرفوعة.",
    );
  }

  const pathname =
    `user-media/${userId}/${kind}/${randomUUID()}${validated.extension}`;

  try {
    const blob = await putPrivateBlob(pathname, validated.buffer, validated.mime);
    return {
      storedName: blob.pathname,
      originalName: validated.originalName,
      mime: validated.mime,
      size: validated.size,
    };
  } catch (error) {
    console.error("User media storage failed", {
      userId,
      kind,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    throw new UserMediaStorageError("تخزين الصور الخاصة غير مهيأ أو غير متاح.");
  }
}

export async function deleteUserImage(
  storedName: string | null,
  legacyFolder: "avatars" | "member-covers",
) {
  if (!storedName) return;

  if (storedName.startsWith("user-media/")) {
    await deletePrivateBlobs([storedName]);
    return;
  }

  // Development-only compatibility for media created before Blob migration.
  if (process.env.NODE_ENV === "production") return;
  const safeName = path.basename(storedName);
  await unlink(path.join(process.cwd(), "storage", legacyFolder, safeName)).catch(
    () => undefined,
  );
}

export async function tryDeleteUserImage(
  storedName: string | null,
  legacyFolder: "avatars" | "member-covers",
  context: string,
) {
  try {
    await deleteUserImage(storedName, legacyFolder);
  } catch (error) {
    console.error("User media cleanup failed", {
      context,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
  }
}
