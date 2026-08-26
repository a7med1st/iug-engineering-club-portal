"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  PERMISSIONS,
  requireActivityPermission,
} from "@/lib/permissions";

import { activityDateTimeFromInput } from "@/lib/activities";
import { prisma } from "@/lib/prisma";

const allowedStatuses = [
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
] as const;

type SubmissionStatus =
  (typeof allowedStatuses)[number];

const allowedAttendanceActions = [
  "CHECK_IN",
  "CHECK_OUT",
] as const;

type AttendanceAction =
  (typeof allowedAttendanceActions)[number];

function revalidateRegistrationPages(
  activityId: string,
) {
  revalidatePath(
    `/admin/activities/${activityId}/registrations`,
  );

  revalidatePath(
    `/admin/activities/${activityId}/check-in`,
  );

  revalidatePath(
    `/activities/${activityId}/register`,
  );

  revalidatePath("/activities");
  revalidatePath("/admin/activities");
  revalidatePath("/student");
  revalidatePath("/notifications");
}

function revalidateActivityDetailsPages(activityId: string) {
  revalidatePath(`/admin/activities/${activityId}/registrations`);
  revalidatePath(`/admin/activities/${activityId}/check-in`);
  revalidatePath(`/activities/${activityId}/register`);
  revalidatePath(`/activities/${activityId}`);
  revalidatePath("/activities");
  revalidatePath("/admin/activities");
  revalidatePath("/student");
  revalidatePath("/");
}

export type UpdateActivityLocationState = {
  success: boolean;
  message: string;
  location?: string;
};

export async function updateActivityLocation(
  _previousState: UpdateActivityLocationState,
  formData: FormData,
): Promise<UpdateActivityLocationState> {
  const activityId = String(formData.get("activityId") ?? "").trim();
  const location = String(formData.get("activityLocation") ?? "").trim();

  if (!activityId) {
    return {
      success: false,
      message: "معرّف النشاط غير صالح.",
    };
  }

  if (!location) {
    return {
      success: false,
      message: "يرجى إدخال موقع النشاط.",
    };
  }

  if (location.length > 250) {
    return {
      success: false,
      message: "موقع النشاط طويل جدًا. الحد الأقصى 250 حرفًا.",
    };
  }

  await requireActivityPermission(
    PERMISSIONS.ACTIVITY_MANAGE,
    activityId,
  );

  try {
    const activity = await prisma.activity.update({
      where: { id: activityId },
      data: { location },
      select: { location: true },
    });

    revalidateActivityDetailsPages(activityId);

    return {
      success: true,
      message: "تم تحديث موقع النشاط بنجاح.",
      location: activity.location,
    };
  } catch (error) {
    console.error("Failed to update activity location", {
      activityId,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return {
      success: false,
      message: "تعذر حفظ الموقع الآن. يرجى المحاولة مرة أخرى.",
    };
  }
}

export type UpdateActivityDateState = {
  success: boolean;
  message: string;
  startsAt?: string;
  endsAt?: string | null;
};

export async function updateActivityDate(
  _previousState: UpdateActivityDateState,
  formData: FormData,
): Promise<UpdateActivityDateState> {
  const activityId = String(formData.get("activityId") ?? "").trim();
  const dateValue = String(formData.get("startDate") ?? "").trim();
  const timeValue = String(formData.get("startTime") ?? "").trim();
  const endDateValue = String(formData.get("endDate") ?? "").trim();
  const endTimeValue = String(formData.get("endTime") ?? "").trim();

  if (!activityId) {
    return {
      success: false,
      message: "معرّف النشاط غير صالح.",
    };
  }

  const startsAt = activityDateTimeFromInput(dateValue, timeValue);

  if (!startsAt) {
    return {
      success: false,
      message: "يرجى إدخال تاريخ ووقت صالحين.",
    };
  }

  if (Boolean(endDateValue) !== Boolean(endTimeValue)) {
    return {
      success: false,
      message: "أدخل تاريخ ووقت نهاية النشاط معًا، أو اترك الحقلين فارغين.",
    };
  }

  const endsAt = endDateValue && endTimeValue
    ? activityDateTimeFromInput(endDateValue, endTimeValue)
    : null;

  if (endDateValue && endTimeValue && !endsAt) {
    return {
      success: false,
      message: "يرجى إدخال تاريخ ووقت نهاية صالحين.",
    };
  }

  if (endsAt && endsAt.getTime() <= startsAt.getTime()) {
    return {
      success: false,
      message: "يجب أن يكون موعد نهاية النشاط بعد موعد البداية.",
    };
  }

  await requireActivityPermission(
    PERMISSIONS.ACTIVITY_MANAGE,
    activityId,
  );

  try {
    const activity = await prisma.activity.update({
      where: { id: activityId },
      data: { startsAt, endsAt },
      select: { startsAt: true, endsAt: true },
    });

    revalidateActivityDetailsPages(activityId);

    return {
      success: true,
      message: "تم تحديث تاريخ ووقت النشاط بنجاح.",
      startsAt: activity.startsAt.toISOString(),
      endsAt: activity.endsAt?.toISOString() ?? null,
    };
  } catch (error) {
    console.error("Failed to update activity date", {
      activityId,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return {
      success: false,
      message: "تعذر حفظ التعديل الآن. يرجى المحاولة مرة أخرى.",
    };
  }
}

/* =========================================================
   UPDATE ONE REGISTRATION STATUS
========================================================= */

export async function updateRegistrationStatus(
  formData: FormData,
) {
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

  await requireActivityPermission(
    PERMISSIONS.REGISTRATION_REVIEW,
    activityId,
  );

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
                userId: true,


                form: {
                  select: {
                    activity: {
                      select: {
                        id: true,
                        title: true,
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

              /*
               * إذا لم يعد الطالب "مقبولًا"
               * فلا يجوز أن يبقى مسجلًا كحاضر.
               */
              ...(status !== "APPROVED"
                ? {
                    checkedInAt: null,
                    checkedInById: null,
                  }
                : {}),
            },
          });

          if (
            submission.userId &&
            (
              status === "APPROVED" ||
              status === "REJECTED"
            )
          ) {
            await tx.notification.create({
              data: {
                userId:
                  submission.userId,

                type:
                  status === "APPROVED"
                    ? "ACTIVITY_APPROVED"
                    : "ACTIVITY_REJECTED",

                title:
                  status === "APPROVED"
                    ? `تم قبول تسجيلك في ${submission.form.activity.title}`
                    : `تم رفض تسجيلك في ${submission.form.activity.title}`,

                body:
                  status === "APPROVED"
                    ? "تمت مراجعة طلبك وقبوله. يمكنك مراجعة تفاصيل النشاط من لوحة الطالب."
                    : "تمت مراجعة طلبك وتحديث حالته إلى مرفوض. يمكنك مراجعة تفاصيل التسجيل من لوحة الطالب.",

                href:
                  status === "APPROVED"
                    ? "/student?activityTab=all#my-activities"
                    : "/student?activityTab=rejected#my-activities",
              },
            });
          }
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
   MANUAL CHECK-IN / CHECK-OUT
========================================================= */

export async function updateRegistrationAttendance(
  formData: FormData,
) {
  const activityId = String(
    formData.get("activityId") ?? "",
  ).trim();

  const submissionId = String(
    formData.get("submissionId") ?? "",
  ).trim();

  const requestedAction = String(
    formData.get("attendanceAction") ?? "",
  ).trim();

  if (
    !activityId ||
    !submissionId ||
    !allowedAttendanceActions.includes(
      requestedAction as AttendanceAction,
    )
  ) {
    return;
  }

  const attendanceAction =
    requestedAction as AttendanceAction;

  const { user } =
    await requireActivityPermission(
      PERMISSIONS.ATTENDANCE_MANUAL,
      activityId,
    );

  const basePath =
    `/admin/activities/${activityId}/registrations`;

  const submission =
    await prisma.activityFormSubmission.findFirst({
      where: {
        id: submissionId,

        form: {
          activityId,
        },
      },

      select: {
        id: true,
        status: true,
        checkedInAt: true,
      },
    });

  if (!submission) {
    redirect(
      `${basePath}?error=${encodeURIComponent(
        "التسجيل غير موجود لهذا النشاط.",
      )}`,
    );
  }

  if (
    submission.status !== "APPROVED"
  ) {
    redirect(
      `${basePath}?error=${encodeURIComponent(
        "يمكن تسجيل الحضور للطلاب المقبولين فقط.",
      )}`,
    );
  }

  if (
    attendanceAction === "CHECK_IN"
  ) {
    if (submission.checkedInAt) {
      redirect(
        `${basePath}?error=${encodeURIComponent(
          "تم تسجيل حضور هذا الطالب مسبقًا.",
        )}`,
      );
    }

    const checkedInAt =
      new Date();

    /*
     * updateMany يمنع الضغط المزدوج أو تسجيل
     * الحضور مرتين في نفس اللحظة.
     */
    const result =
      await prisma.activityFormSubmission.updateMany({
        where: {
          id: submission.id,
          status: "APPROVED",
          checkedInAt: null,
        },

        data: {
          checkedInAt,
          checkedInById:
            user.id,
        },
      });

    if (result.count !== 1) {
      redirect(
        `${basePath}?error=${encodeURIComponent(
          "تعذر تسجيل الحضور. حدّث الصفحة وحاول مرة أخرى.",
        )}`,
      );
    }

    revalidateRegistrationPages(
      activityId,
    );

    redirect(
      `${basePath}?success=${encodeURIComponent(
        "تم تسجيل حضور الطالب يدويًا بنجاح.",
      )}`,
    );
  }

  /*
   * CHECK_OUT
   */
  if (!submission.checkedInAt) {
    redirect(
      `${basePath}?error=${encodeURIComponent(
        "هذا الطالب غير مسجل كحاضر أصلًا.",
      )}`,
    );
  }

  await prisma.activityFormSubmission.updateMany({
    where: {
      id: submission.id,
      status: "APPROVED",
      checkedInAt: {
        not: null,
      },
    },

    data: {
      checkedInAt: null,
      checkedInById: null,
    },
  });

  revalidateRegistrationPages(
    activityId,
  );

  redirect(
    `${basePath}?success=${encodeURIComponent(
      "تم إلغاء تسجيل حضور الطالب.",
    )}`,
  );
}

/* =========================================================
   ARCHIVE / RESTORE ACTIVITY
========================================================= */

export async function updateActivityArchiveState(
  formData: FormData,
) {
  const activityId = String(
    formData.get("activityId") ?? "",
  ).trim();

  const requestedState = String(
    formData.get("activityState") ?? "",
  ).trim();

  if (
    !activityId ||
    ![
      "ARCHIVED",
      "PUBLISHED",
    ].includes(requestedState)
  ) {
    return;
  }

  await requireActivityPermission(
    PERMISSIONS.ACTIVITY_ARCHIVE,
    activityId,
  );

  const basePath =
    `/admin/activities/${activityId}/registrations`;

  const activity =
    await prisma.activity.findUnique({
      where: {
        id: activityId,
      },

      select: {
        id: true,
        status: true,
        registrationForm: {
          select: {
            id: true,
          },
        },
      },
    });

  if (!activity) {
    redirect(
      `${basePath}?error=${encodeURIComponent(
        "النشاط غير موجود.",
      )}`,
    );
  }

  const nextStatus =
    requestedState === "ARCHIVED"
      ? "ARCHIVED"
      : "PUBLISHED";

  if (activity.status === nextStatus) {
    return;
  }

  await prisma.$transaction(
    async (tx) => {
      await tx.activity.update({
        where: {
          id: activityId,
        },

        data: {
          status: nextStatus,
        },
      });

      /*
       * عند الأرشفة نغلق التسجيل تلقائيًا.
       * وعند إعادة النشاط إلى منشور لا نفتح التسجيل
       * تلقائيًا؛ الأدمن يقرر ذلك يدويًا من الإعدادات.
       */
      if (
        nextStatus === "ARCHIVED" &&
        activity.registrationForm
      ) {
        await tx.activityRegistrationForm.update({
          where: {
            id:
              activity.registrationForm.id,
          },

          data: {
            isOpen: false,
          },
        });
      }
    },
  );

  revalidateRegistrationPages(
    activityId,
  );

  redirect(
    `${basePath}?success=${encodeURIComponent(
      nextStatus === "ARCHIVED"
        ? "تمت أرشفة النشاط وإغلاق التسجيل بنجاح."
        : "تمت إعادة النشاط إلى حالة منشور. التسجيل بقي مغلقًا حتى تفتحه يدويًا.",
    )}`,
  );
}

/* =========================================================
   UPDATE CAPACITY + OPEN/CLOSE REGISTRATION
========================================================= */

export async function updateRegistrationSettings(
  formData: FormData,
) {
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

  await requireActivityPermission(
    PERMISSIONS.REGISTRATION_SETTINGS,
    activityId,
  );

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
    | "ACTIVITY_ARCHIVED"
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

                activity: {
                  select: {
                    status: true,
                  },
                },
              },
            });

          if (!form) {
            throw new Error(
              "FORM_NOT_FOUND",
            );
          }

          if (
            form.activity.status ===
            "ARCHIVED"
          ) {
            throw new Error(
              "ACTIVITY_ARCHIVED",
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
        error instanceof Error &&
        error.message ===
          "ACTIVITY_ARCHIVED"
      ) {
        businessError =
          "ACTIVITY_ARCHIVED";
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

  if (
    businessError ===
    "ACTIVITY_ARCHIVED"
  ) {
    redirect(
      `${basePath}?error=${encodeURIComponent(
        "النشاط مؤرشف. أعده إلى حالة منشور قبل تعديل إعدادات التسجيل.",
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
