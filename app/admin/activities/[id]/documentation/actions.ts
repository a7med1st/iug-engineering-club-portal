"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  ActivityImageStorageError,
  tryDeleteActivityImages,
  uploadActivityImage,
} from "@/lib/activity-image-storage";
import { PERMISSIONS, requireActivityPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  UploadRateLimitError,
  enforceActivityUploadLimit,
  uploadRateLimitMessage,
} from "@/lib/upload-rate-limit";

class ActivityDocumentationError extends Error {}

function requiredValue(formData: FormData, field: string) {
  const value = String(formData.get(field) ?? "").trim();

  if (!value) {
    throw new ActivityDocumentationError("بيانات الطلب غير مكتملة.");
  }

  return value;
}

function documentationPath(activityId: string) {
  return `/admin/activities/${activityId}/documentation`;
}

function revalidateActivityPages(activityId: string) {
  revalidatePath("/");
  revalidatePath("/activities");
  revalidatePath(`/activities/${activityId}`);
  revalidatePath("/admin/activities");
  revalidatePath(documentationPath(activityId));
}

async function runDocumentationAction(
  activityId: string,
  successMessage: string,
  fallbackError: string,
  action: () => Promise<void>,
): Promise<never> {
  try {
    await action();
  } catch (error) {
    const message =
      error instanceof ActivityDocumentationError ||
      error instanceof ActivityImageStorageError
        ? error.message
        : fallbackError;

    redirect(
      `${documentationPath(activityId)}?error=${encodeURIComponent(message)}`,
    );
  }

  redirect(
    `${documentationPath(activityId)}?success=${encodeURIComponent(successMessage)}`,
  );
}

export async function savePostEventSummary(formData: FormData) {
  const activityId = requiredValue(formData, "activityId");
  await requireActivityPermission(PERMISSIONS.ACTIVITY_MANAGE, activityId);

  return runDocumentationAction(
    activityId,
    "تم حفظ ملخص الفعالية.",
    "تعذر حفظ ملخص الفعالية.",
    async () => {
      const summary = String(formData.get("postEventSummary") ?? "").trim();

      if (summary.length > 10_000) {
        throw new ActivityDocumentationError(
          "ملخص الفعالية طويل جدًا. الحد الأقصى 10000 حرف.",
        );
      }

      await prisma.activity.update({
        where: { id: activityId },
        data: { postEventSummary: summary || null },
      });

      revalidateActivityPages(activityId);
    },
  );
}

export async function uploadActivityCover(formData: FormData) {
  const activityId = requiredValue(formData, "activityId");
  const { user } = await requireActivityPermission(PERMISSIONS.ACTIVITY_MANAGE, activityId);

  return runDocumentationAction(
    activityId,
    "تم حفظ صورة غلاف الفعالية.",
    "تعذر رفع صورة الغلاف.",
    async () => {
      const file = formData.get("image");

      if (!(file instanceof File)) {
        throw new ActivityDocumentationError("اختر صورة غلاف صالحة.");
      }

      try {
        await enforceActivityUploadLimit(user.id, file.size);
      } catch (error) {
        if (error instanceof UploadRateLimitError) {
          throw new ActivityDocumentationError(uploadRateLimitMessage(error));
        }
        throw error;
      }

      const previous = await prisma.activity.findUnique({
        where: { id: activityId },
        select: {
          coverImageUrl: true,
          coverImagePathname: true,
          coverImageOriginalName: true,
          coverImageMime: true,
          coverImageSize: true,
        },
      });

      if (!previous) {
        throw new ActivityDocumentationError("النشاط غير موجود.");
      }

      const uploaded = await uploadActivityImage(file, activityId, "cover");

      try {
        await prisma.activity.update({
          where: { id: activityId },
          data: {
            coverImageUrl: uploaded.url,
            coverImagePathname: uploaded.pathname,
            coverImageOriginalName: uploaded.originalName,
            coverImageMime: uploaded.mime,
            coverImageSize: uploaded.size,
          },
        });
      } catch (error) {
        await tryDeleteActivityImages([uploaded.pathname], "cover-db-failure");
        throw error;
      }

      if (previous.coverImagePathname) {
        await tryDeleteActivityImages(
          [previous.coverImagePathname],
          "replace-activity-cover",
        );
      }

      revalidateActivityPages(activityId);
    },
  );
}

export async function removeActivityCover(formData: FormData) {
  const activityId = requiredValue(formData, "activityId");
  await requireActivityPermission(PERMISSIONS.ACTIVITY_MANAGE, activityId);

  return runDocumentationAction(
    activityId,
    "تم حذف صورة الغلاف.",
    "تعذر حذف صورة الغلاف.",
    async () => {
      const previous = await prisma.activity.findUnique({
        where: { id: activityId },
        select: {
          coverImageUrl: true,
          coverImagePathname: true,
          coverImageOriginalName: true,
          coverImageMime: true,
          coverImageSize: true,
        },
      });

      if (!previous?.coverImagePathname) {
        throw new ActivityDocumentationError("لا توجد صورة غلاف لحذفها.");
      }

      await prisma.activity.update({
        where: { id: activityId },
        data: {
          coverImageUrl: null,
          coverImagePathname: null,
          coverImageOriginalName: null,
          coverImageMime: null,
          coverImageSize: null,
        },
      });

      await tryDeleteActivityImages(
        [previous.coverImagePathname],
        "remove-activity-cover",
      );

      revalidateActivityPages(activityId);
    },
  );
}

export async function uploadActivityGalleryImage(formData: FormData) {
  const activityId = requiredValue(formData, "activityId");
  const { user } = await requireActivityPermission(PERMISSIONS.ACTIVITY_MANAGE, activityId);

  return runDocumentationAction(
    activityId,
    "تمت إضافة الصورة إلى معرض الفعالية.",
    "تعذر إضافة الصورة إلى المعرض.",
    async () => {
      const file = formData.get("image");

      if (!(file instanceof File)) {
        throw new ActivityDocumentationError("اختر صورة صالحة للمعرض.");
      }

      try {
        await enforceActivityUploadLimit(user.id, file.size);
      } catch (error) {
        if (error instanceof UploadRateLimitError) {
          throw new ActivityDocumentationError(uploadRateLimitMessage(error));
        }
        throw error;
      }
      const uploaded = await uploadActivityImage(file, activityId, "gallery");

      try {
        await prisma.$transaction(async (tx) => {
          await tx.$queryRaw`
            SELECT pg_advisory_xact_lock(hashtextextended(${activityId}, 0))::text AS "lock"
          `;

          const [lastImage, imageCount] = await Promise.all([
            tx.activityImage.aggregate({
              where: { activityId },
              _max: { sortOrder: true },
            }),
            tx.activityImage.count({ where: { activityId } }),
          ]);

          if (imageCount >= 30) {
            throw new ActivityDocumentationError(
              "وصل معرض الفعالية إلى الحد الأقصى وهو 30 صورة.",
            );
          }

          await tx.activityImage.create({
            data: {
              activityId,
              ...uploaded,
              sortOrder: (lastImage._max.sortOrder ?? -1) + 1,
            },
          });
        });
      } catch (error) {
        await tryDeleteActivityImages([uploaded.pathname], "gallery-db-failure");
        throw error;
      }

      revalidateActivityPages(activityId);
    },
  );
}

export async function removeActivityGalleryImage(formData: FormData) {
  const activityId = requiredValue(formData, "activityId");
  const imageId = requiredValue(formData, "imageId");
  await requireActivityPermission(PERMISSIONS.ACTIVITY_MANAGE, activityId);

  return runDocumentationAction(
    activityId,
    "تم حذف الصورة من معرض الفعالية.",
    "تعذر حذف صورة المعرض.",
    async () => {
      const image = await prisma.activityImage.findFirst({
        where: { id: imageId, activityId },
      });

      if (!image) {
        throw new ActivityDocumentationError("صورة المعرض غير موجودة.");
      }

      await prisma.activityImage.delete({ where: { id: image.id } });

      await tryDeleteActivityImages([image.pathname], "remove-gallery-image");

      revalidateActivityPages(activityId);
    },
  );
}

export async function moveActivityGalleryImage(formData: FormData) {
  const activityId = requiredValue(formData, "activityId");
  const imageId = requiredValue(formData, "imageId");
  const direction = requiredValue(formData, "direction");
  await requireActivityPermission(PERMISSIONS.ACTIVITY_MANAGE, activityId);

  return runDocumentationAction(
    activityId,
    "تم تحديث ترتيب صور الفعالية.",
    "تعذر تحديث ترتيب الصور.",
    async () => {
      if (direction !== "up" && direction !== "down") {
        throw new ActivityDocumentationError("اتجاه الترتيب غير صالح.");
      }

      const current = await prisma.activityImage.findFirst({
        where: { id: imageId, activityId },
      });

      if (!current) {
        throw new ActivityDocumentationError("صورة المعرض غير موجودة.");
      }

      const adjacent = await prisma.activityImage.findFirst({
        where: {
          activityId,
          sortOrder:
            direction === "up"
              ? { lt: current.sortOrder }
              : { gt: current.sortOrder },
        },
        orderBy: {
          sortOrder: direction === "up" ? "desc" : "asc",
        },
      });

      if (!adjacent) return;

      await prisma.$transaction([
        prisma.activityImage.update({
          where: { id: current.id },
          data: { sortOrder: adjacent.sortOrder },
        }),
        prisma.activityImage.update({
          where: { id: adjacent.id },
          data: { sortOrder: current.sortOrder },
        }),
      ]);

      revalidateActivityPages(activityId);
    },
  );
}
