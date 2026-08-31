import { randomUUID } from "node:crypto";

import { ACTIVITY_IMAGE_MAX_BYTES } from "@/lib/activity-image-constants";
import {
  deletePublicBlobs,
  putPublicBlob,
  requirePublicStorage,
} from "@/lib/blob-storage";
import {
  UploadValidationError,
  validateAndProcessImage,
} from "@/lib/upload-security";

export class ActivityImageStorageError extends Error {}

export type StoredActivityImage = {
  url: string;
  pathname: string;
  originalName: string;
  mime: string;
  size: number;
};

function requireActivityStorage() {
  try {
    requirePublicStorage();
  } catch {
    throw new ActivityImageStorageError(
      "تخزين صور الأنشطة غير مهيأ. راجع إعدادات تخزين الملفات في متغيرات البيئة.",
    );
  }
}

export async function validateActivityImage(file: File) {
  try {
    return await validateAndProcessImage(file, {
      maxBytes: ACTIVITY_IMAGE_MAX_BYTES,
      maxWidth: 6_000,
      maxHeight: 6_000,
      maxPixels: 24_000_000,
    });
  } catch (error) {
    throw new ActivityImageStorageError(
      error instanceof UploadValidationError
        ? error.message
        : "تعذر التحقق من الصورة المرفوعة.",
    );
  }
}

export async function uploadActivityImage(
  file: File,
  activityId: string,
  kind: "cover" | "gallery",
): Promise<StoredActivityImage> {
  requireActivityStorage();
  const validated = await validateActivityImage(file);
  const pathname = `activity-images/${activityId}/${kind}/${randomUUID()}${validated.extension}`;
  const blob = await putPublicBlob(
    pathname,
    validated.buffer,
    validated.mime,
    31_536_000,
  );

  return {
    url: blob.url,
    pathname: blob.pathname,
    originalName: validated.originalName,
    mime: validated.mime,
    size: validated.size,
  };
}

function safeActivityPathname(pathname: string) {
  return pathname.startsWith("activity-images/");
}

export async function deleteActivityImages(
  pathnames: Array<string | null | undefined>,
) {
  const safePathnames = [
    ...new Set(pathnames.filter((item): item is string => Boolean(item))),
  ].filter(safeActivityPathname);

  if (safePathnames.length === 0) return;

  requireActivityStorage();
  await deletePublicBlobs(safePathnames);
}

export async function tryDeleteActivityImages(
  pathnames: Array<string | null | undefined>,
  context: string,
) {
  try {
    await deleteActivityImages(pathnames);
  } catch (error) {
    console.error("Activity image cleanup failed", {
      context,
      count: pathnames.filter(Boolean).length,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
  }
}
