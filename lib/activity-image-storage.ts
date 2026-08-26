import { del, put } from "@vercel/blob";
import { randomUUID } from "node:crypto";

import { ACTIVITY_IMAGE_MAX_BYTES } from "@/lib/activity-image-constants";

const IMAGE_EXTENSIONS = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export class ActivityImageStorageError extends Error {}

export type StoredActivityImage = {
  url: string;
  pathname: string;
  originalName: string;
  mime: string;
  size: number;
};

function requireBlobToken() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new ActivityImageStorageError(
      "تخزين صور الأنشطة غير مهيأ. أضف BLOB_READ_WRITE_TOKEN إلى متغيرات البيئة.",
    );
  }
}

export async function validateActivityImage(file: File) {
  if (!(file instanceof File) || file.size === 0) {
    throw new ActivityImageStorageError("اختر صورة صالحة للرفع.");
  }

  const extension = IMAGE_EXTENSIONS.get(file.type);

  if (!extension) {
    throw new ActivityImageStorageError(
      "صيغة الصورة غير مدعومة. استخدم JPEG أو PNG أو WebP.",
    );
  }

  if (file.size > ACTIVITY_IMAGE_MAX_BYTES) {
    throw new ActivityImageStorageError(
      "حجم الصورة أكبر من الحد المسموح وهو 4 ميجابايت.",
    );
  }

  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const matchesMime =
    (file.type === "image/jpeg" &&
      header[0] === 0xff &&
      header[1] === 0xd8 &&
      header[2] === 0xff) ||
    (file.type === "image/png" &&
      header[0] === 0x89 &&
      header[1] === 0x50 &&
      header[2] === 0x4e &&
      header[3] === 0x47 &&
      header[4] === 0x0d &&
      header[5] === 0x0a &&
      header[6] === 0x1a &&
      header[7] === 0x0a) ||
    (file.type === "image/webp" &&
      String.fromCharCode(...header.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...header.slice(8, 12)) === "WEBP");

  if (!matchesMime) {
    throw new ActivityImageStorageError(
      "محتوى الملف لا يطابق صيغة الصورة المعلنة.",
    );
  }

  return extension;
}

export async function uploadActivityImage(
  file: File,
  activityId: string,
  kind: "cover" | "gallery",
): Promise<StoredActivityImage> {
  requireBlobToken();
  const extension = await validateActivityImage(file);
  const pathname = `activity-images/${activityId}/${kind}/${randomUUID()}.${extension}`;
  const blob = await put(pathname, file, {
    access: "public",
    addRandomSuffix: false,
    contentType: file.type,
    cacheControlMaxAge: 31_536_000,
  });

  return {
    url: blob.url,
    pathname: blob.pathname,
    originalName: file.name.slice(0, 255) || `activity.${extension}`,
    mime: file.type,
    size: file.size,
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

  requireBlobToken();
  await del(safePathnames);
}
