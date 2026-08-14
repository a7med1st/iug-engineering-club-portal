"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const allowedStatuses = [
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
] as const;

type SubmissionStatus =
  (typeof allowedStatuses)[number];

function revalidateRegistrationPages(
  activityId: string,
) {
  revalidatePath(
    `/admin/activities/${activityId}/registrations`,
  );

  revalidatePath(
    `/activities/${activityId}/register`,
  );

  revalidatePath("/activities");
  revalidatePath("/admin/activities");
}

/* =========================================================
   UPDATE ONE REGISTRATION STATUS
========================================================= */

export async function updateRegistrationStatus(
  formData: FormData,
) {
  await requireAdmin();

  const activityId = String(
    formData.get("activityId") ?? "",
  ).trim();

  const submissionId = String(
    formData.get("submissionId") ?? "",
  ).trim();

  const requestedStatus = String(
    formData.get("status") ?? "",
  ).trim();

  if (
    !activityId ||
    !submissionId ||
    !allowedStatuses.includes(
      requestedStatus as SubmissionStatus,
    )
  ) {
    return;
  }

  const status =
    requestedStatus as SubmissionStatus;

  const maxAttempts = 3;

  for (
    let attempt = 1;
    attempt <= maxAttempts;
    attempt++
  ) {
    try {
      await prisma.$transaction(
        async (tx) => {
          const submission =
            await tx.activityFormSubmission.findFirst({
              where: {
                id: submissionId,

                form: {
                  activityId,
                },
              },

              select: {
                id: true,
                status: true,
                formId: true,

                form: {
                  select: {
                    activity: {
                      select: {
                        capacity: true,
                      },
                    },
                  },
                },
              },
            });

          if (!submission) {
            throw new Error(
              "REGISTRATION_NOT_FOUND",
            );
          }

          if (
            submission.status === status
          ) {
            return;
          }

          /*
           * SUBMITTED + APPROVED يحجزان مقعدًا.
           * REJECTED لا يحجز مقعدًا.
           *
           * لذلك عند إعادة طالب مرفوض للمراجعة
           * أو قبوله، يجب وجود مقعد متاح.
           */
          const needsSeat =
            submission.status ===
              "REJECTED" &&
            status !== "REJECTED";

          if (needsSeat) {
            const occupiedSeats =
              await tx.activityFormSubmission.count({
                where: {
                  formId:
                    submission.formId,

                  status: {
                    not: "REJECTED",
                  },
                },
              });

            const capacity =
              submission.form.activity
                .capacity;

            if (
              capacity > 0 &&
              occupiedSeats >= capacity
            ) {
              throw new Error(
                "CAPACITY_FULL",
              );
            }
          }

          await tx.activityFormSubmission.update({
            where: {
              id: submission.id,
            },

            data: {
              status,
            },
          });
        },
        {
          isolationLevel:
            Prisma.TransactionIsolationLevel
              .Serializable,
        },
      );

      break;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message ===
          "REGISTRATION_NOT_FOUND"
      ) {
        return;
      }

      if (
        error instanceof Error &&
        error.message ===
          "CAPACITY_FULL"
      ) {
        redirect(
          `/admin/activities/${activityId}/registrations?error=${encodeURIComponent(
            "لا يمكن إعادة هذا التسجيل أو قبوله لأن جميع المقاعد ممتلئة.",
          )}`,
        );
      }

      if (
        error instanceof
          Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034" &&
        attempt < maxAttempts
      ) {
        continue;
      }

      throw error;
    }
  }

  revalidateRegistrationPages(
    activityId,
  );
}

/* =========================================================
   UPDATE CAPACITY + OPEN/CLOSE REGISTRATION
========================================================= */

export async function updateRegistrationSettings(
  formData: FormData,
) {
  await requireAdmin();

  const activityId = String(
    formData.get("activityId") ?? "",
  ).trim();

  const capacity = Number(
    formData.get("capacity"),
  );

  const isOpen =
    formData.get("isOpen") === "on";

  const basePath =
    `/admin/activities/${activityId}/registrations`;

  if (!activityId) {
    return;
  }

  if (
    !Number.isInteger(capacity) ||
    capacity < 1 ||
    capacity > 100_000
  ) {
    redirect(
      `${basePath}?error=${encodeURIComponent(
        "السعة يجب أن تكون رقمًا صحيحًا بين 1 و100000.",
      )}`,
    );
  }

  let businessError:
    | "FORM_NOT_FOUND"
    | "CAPACITY_TOO_SMALL"
    | null = null;

  const maxAttempts = 3;

  for (
    let attempt = 1;
    attempt <= maxAttempts;
    attempt++
  ) {
    try {
      await prisma.$transaction(
        async (tx) => {
          const form =
            await tx.activityRegistrationForm.findUnique({
              where: {
                activityId,
              },

              select: {
                id: true,
              },
            });

          if (!form) {
            throw new Error(
              "FORM_NOT_FOUND",
            );
          }

          const occupiedSeats =
            await tx.activityFormSubmission.count({
              where: {
                formId: form.id,

                status: {
                  not: "REJECTED",
                },
              },
            });

          /*
           * لا نسمح للأدمن بتخفيض السعة
           * إلى أقل من عدد المقاعد المشغولة.
           */
          if (
            capacity < occupiedSeats
          ) {
            throw new Error(
              "CAPACITY_TOO_SMALL",
            );
          }

          await tx.activity.update({
            where: {
              id: activityId,
            },

            data: {
              capacity,
            },
          });

          await tx.activityRegistrationForm.update({
            where: {
              id: form.id,
            },

            data: {
              isOpen,
            },
          });
        },
        {
          isolationLevel:
            Prisma.TransactionIsolationLevel
              .Serializable,
        },
      );

      businessError = null;
      break;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message ===
          "FORM_NOT_FOUND"
      ) {
        businessError =
          "FORM_NOT_FOUND";
        break;
      }

      if (
        error instanceof Error &&
        error.message ===
          "CAPACITY_TOO_SMALL"
      ) {
        businessError =
          "CAPACITY_TOO_SMALL";
        break;
      }

      if (
        error instanceof
          Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034" &&
        attempt < maxAttempts
      ) {
        continue;
      }

      throw error;
    }
  }

  if (
    businessError ===
    "FORM_NOT_FOUND"
  ) {
    redirect(
      `${basePath}?error=${encodeURIComponent(
        "نموذج التسجيل غير موجود لهذا النشاط.",
      )}`,
    );
  }

  if (
    businessError ===
    "CAPACITY_TOO_SMALL"
  ) {
    redirect(
      `${basePath}?error=${encodeURIComponent(
        "لا يمكن جعل السعة أقل من عدد المقاعد المشغولة حاليًا.",
      )}`,
    );
  }

  revalidateRegistrationPages(
    activityId,
  );

  redirect(
    `${basePath}?success=${encodeURIComponent(
      `تم حفظ الإعدادات. التسجيل الآن ${
        isOpen ? "مفتوح" : "مغلق"
      } والسعة ${capacity} مقعد.`,
    )}`,
  );
}