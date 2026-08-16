"use server";

import { prisma } from "@/lib/prisma";

const REMINDER_BEFORE_HOURS = 18;

/*
 * The scheduler is intentionally kept separate from this feature.
 *
 * When this function is called, it looks for approved activities
 * whose start time is around the 18-hour reminder point.
 *
 * The 60-minute window lets a future hourly scheduler call the
 * endpoint without creating duplicate notifications. reminderKey
 * guarantees that every student receives only one 18h reminder
 * per activity.
 */
const REMINDER_WINDOW_MINUTES = 60;

function addMilliseconds(
  date: Date,
  milliseconds: number,
) {
  return new Date(
    date.getTime() +
      milliseconds,
  );
}

export async function sendActivityReminders(
  now = new Date(),
) {
  const target =
    addMilliseconds(
      now,
      REMINDER_BEFORE_HOURS *
        60 *
        60 *
        1000,
    );

  const halfWindowMs =
    (REMINDER_WINDOW_MINUTES /
      2) *
    60 *
    1000;

  const windowStart =
    addMilliseconds(
      target,
      -halfWindowMs,
    );

  const windowEnd =
    addMilliseconds(
      target,
      halfWindowMs,
    );

  const approved =
    await prisma.activityFormSubmission.findMany({
      where: {
        status: "APPROVED",

        userId: {
          not: null,
        },

        form: {
          activity: {
            status:
              "PUBLISHED",

            startsAt: {
              gte:
                windowStart,

              lt:
                windowEnd,
            },
          },
        },
      },

      select: {
        userId: true,

        form: {
          select: {
            activity: {
              select: {
                id: true,
                title: true,
                startsAt: true,
                location: true,
              },
            },
          },
        },
      },
    });

  const uniqueTargets =
    new Map<
      string,
      {
        userId: string;
        activityId: string;
        title: string;
        startsAt: Date;
        location: string;
      }
    >();

  for (
    const registration
    of approved
  ) {
    if (
      !registration.userId
    ) {
      continue;
    }

    const activity =
      registration.form.activity;

    const key =
      `${registration.userId}:${activity.id}`;

    uniqueTargets.set(
      key,
      {
        userId:
          registration.userId,

        activityId:
          activity.id,

        title:
          activity.title,

        startsAt:
          activity.startsAt,

        location:
          activity.location,
      },
    );
  }

  if (
    uniqueTargets.size === 0
  ) {
    return {
      checkedAt:
        now.toISOString(),

      targetHours:
        REMINDER_BEFORE_HOURS,

      candidates: 0,
      created: 0,
    };
  }

  const notifications =
    Array.from(
      uniqueTargets.values(),
    ).map((item) => {
      const formattedDate =
        new Intl.DateTimeFormat(
          "ar-PS",
          {
            dateStyle:
              "medium",

            timeStyle:
              "short",
          },
        ).format(
          item.startsAt,
        );

      return {
        userId:
          item.userId,

        type:
          "ACTIVITY_REMINDER" as const,

        title:
          `تذكير: ${item.title} بعد 18 ساعة`,

        body:
          `${formattedDate} · ${item.location}`,

        href:
          "/student?activityTab=all#my-activities",

        reminderKey:
          `activity-18h:${item.activityId}:${item.userId}`,
      };
    });

  const result =
    await prisma.notification.createMany({
      data:
        notifications,

      skipDuplicates:
        true,
    });

  return {
    checkedAt:
      now.toISOString(),

    targetHours:
      REMINDER_BEFORE_HOURS,

    candidates:
      notifications.length,

    created:
      result.count,
  };
}
