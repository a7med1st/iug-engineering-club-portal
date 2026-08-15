"use server";

import { revalidatePath } from "next/cache";

import {
  PERMISSIONS,
  requireActivityPermission,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export type MemberCheckInResult = {
  status:
    | "IDLE"
    | "SUCCESS"
    | "ALREADY_CHECKED_IN"
    | "INVALID_QR"
    | "WRONG_ACTIVITY"
    | "NOT_APPROVED"
    | "ACTIVITY_UNAVAILABLE"
    | "ERROR";

  message: string;

  student?: {
    name: string;
    email: string;
    department: string | null;
  };

  checkedInAt?: string;
};

const QR_PREFIX = "ENGCLUB:";

export async function checkInMemberQr(
  activityId: string,
  rawCode: string,
): Promise<MemberCheckInResult> {
  if (!activityId) {
    return {
      status: "INVALID_QR",
      message:
        "النشاط غير صالح.",
    };
  }

  const { user } =
    await requireActivityPermission(
      PERMISSIONS.ATTENDANCE_SCAN,
      activityId,
    );

  const code =
    rawCode.trim();

  if (
    !activityId ||
    !code.startsWith(QR_PREFIX)
  ) {
    return {
      status: "INVALID_QR",
      message:
        "رمز QR غير صالح لنظام النادي الهندسي.",
    };
  }

  const token =
    code
      .slice(QR_PREFIX.length)
      .trim();

  if (!token) {
    return {
      status: "INVALID_QR",
      message:
        "رمز الدخول غير صالح.",
    };
  }

  try {
    const submission =
      await prisma.activityFormSubmission.findUnique({
        where: {
          checkInToken: token,
        },

        select: {
          id: true,
          status: true,
          checkedInAt: true,

          studentName: true,
          studentEmail: true,
          studentDepartment: true,

          form: {
            select: {
              activityId: true,

              activity: {
                select: {
                  id: true,
                  status: true,
                },
              },
            },
          },
        },
      });

    if (!submission) {
      return {
        status: "INVALID_QR",
        message:
          "رمز الدخول غير موجود أو غير صالح.",
      };
    }

    if (
      submission.form.activityId !==
      activityId
    ) {
      return {
        status: "WRONG_ACTIVITY",
        message:
          "هذا الرمز تابع لنشاط آخر، وليس لهذا النشاط.",
      };
    }

    if (
      submission.form.activity.status !==
      "PUBLISHED"
    ) {
      return {
        status:
          "ACTIVITY_UNAVAILABLE",

        message:
          "هذا النشاط غير متاح حاليًا لتسجيل الحضور.",
      };
    }

    if (
      submission.status !==
      "APPROVED"
    ) {
      return {
        status: "NOT_APPROVED",

        message:
          "لا يمكن تسجيل الحضور لأن تسجيل الطالب غير مقبول.",

        student: {
          name:
            submission.studentName,

          email:
            submission.studentEmail,

          department:
            submission.studentDepartment,
        },
      };
    }

    if (submission.checkedInAt) {
      return {
        status:
          "ALREADY_CHECKED_IN",

        message:
          "تم تسجيل حضور هذا الطالب مسبقًا.",

        student: {
          name:
            submission.studentName,

          email:
            submission.studentEmail,

          department:
            submission.studentDepartment,
        },

        checkedInAt:
          submission.checkedInAt.toISOString(),
      };
    }

    const checkedInAt =
      new Date();

    /*
     * التحديث الذري يمنع تسجيل نفس الطالب مرتين
     * لو تمت قراءة الرمز من جهازين بنفس اللحظة.
     */
    const updated =
      await prisma.activityFormSubmission.updateMany({
        where: {
          id: submission.id,
          status: "APPROVED",
          checkedInAt: null,

          form: {
            activityId,
            activity: {
              status: "PUBLISHED",
            },
          },
        },

        data: {
          checkedInAt,
          checkedInById:
            user.id,
        },
      });

    if (updated.count !== 1) {
      const current =
        await prisma.activityFormSubmission.findUnique({
          where: {
            id: submission.id,
          },

          select: {
            status: true,
            checkedInAt: true,
          },
        });

      if (
        current?.checkedInAt
      ) {
        return {
          status:
            "ALREADY_CHECKED_IN",

          message:
            "تم تسجيل حضور هذا الطالب مسبقًا.",

          student: {
            name:
              submission.studentName,

            email:
              submission.studentEmail,

            department:
              submission.studentDepartment,
          },

          checkedInAt:
            current.checkedInAt.toISOString(),
        };
      }

      if (
        current?.status !==
        "APPROVED"
      ) {
        return {
          status:
            "NOT_APPROVED",

          message:
            "لم يعد تسجيل الطالب في حالة مقبول.",
        };
      }

      return {
        status: "ERROR",
        message:
          "تعذر تسجيل الحضور. حاول مرة أخرى.",
      };
    }

    revalidatePath(
      `/member/check-in/${activityId}`,
    );

    revalidatePath(
      "/member/check-in",
    );

    revalidatePath(
      `/admin/activities/${activityId}/registrations`,
    );

    revalidatePath(
      `/admin/activities/${activityId}/check-in`,
    );

    revalidatePath("/student");

    return {
      status: "SUCCESS",

      message:
        "تم تسجيل حضور الطالب بنجاح.",

      student: {
        name:
          submission.studentName,

        email:
          submission.studentEmail,

        department:
          submission.studentDepartment,
      },

      checkedInAt:
        checkedInAt.toISOString(),
    };
  } catch (error) {
    console.error(
      "Member QR check-in error:",
      error,
    );

    return {
      status: "ERROR",
      message:
        "حدث خطأ أثناء تسجيل الحضور.",
    };
  }
}
