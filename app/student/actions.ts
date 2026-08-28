"use server";

import { Prisma } from "@prisma/client";
import type { StudyLevel } from "@prisma/client";
import { revalidatePath } from "next/cache";

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

export type StudentProfileState = {
  success: boolean;
  message: string;
  version?: string;

  fieldErrors?: {
    name?: string;
    studentNumber?: string;
    phone?: string;
    studyLevel?: string;
  };
};

export type StudentAvatarState = {
  success: boolean;
  message: string;
  version?: string;
  removed?: boolean;
};

const STUDY_LEVELS = new Set([
  "FIRST",
  "SECOND",
  "THIRD",
  "FOURTH",
  "FIFTH",
  "GRADUATE",
]);

const MAX_AVATAR_SIZE =
  5 * 1024 * 1024;

function normalizeName(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ");
}

function normalizePhone(value: string) {
  return value
    .trim()
    .replace(/[\s()-]/g, "");
}

/* =========================================================
   STUDENT PROFILE
========================================================= */

export async function updateStudentProfile(
  _previousState: StudentProfileState,
  formData: FormData,
): Promise<StudentProfileState> {
  const { user } = await requirePermission(
    PERMISSIONS.STUDENT_PROFILE_EDIT,
  );

  const name = normalizeName(
    String(
      formData.get("name") ?? "",
    ),
  );

  const studentNumber = String(
    formData.get("studentNumber") ?? "",
  ).trim();

  const phone = normalizePhone(
    String(
      formData.get("phone") ?? "",
    ),
  );

  const studyLevelRaw = String(
    formData.get("studyLevel") ?? "",
  ).trim();

  const fieldErrors: NonNullable<
    StudentProfileState["fieldErrors"]
  > = {};

  /* -------------------------
     NAME
  ------------------------- */

  if (!name) {
    fieldErrors.name =
      "الاسم مطلوب.";
  } else if (name.length < 3) {
    fieldErrors.name =
      "الاسم قصير جدًا.";
  } else if (name.length > 100) {
    fieldErrors.name =
      "الاسم يجب ألا يتجاوز 100 حرف.";
  }

  /* -------------------------
     STUDENT NUMBER
  ------------------------- */

  if (
    studentNumber &&
    !/^\d{5,20}$/.test(
      studentNumber,
    )
  ) {
    fieldErrors.studentNumber =
      "الرقم الجامعي يجب أن يحتوي على أرقام فقط.";
  }

  /* -------------------------
     PHONE
  ------------------------- */

  if (
    phone &&
    !/^\+?\d{7,15}$/.test(phone)
  ) {
    fieldErrors.phone =
      "أدخل رقم جوال صحيحًا.";
  }

  /* -------------------------
     STUDY LEVEL
  ------------------------- */

  if (
    studyLevelRaw &&
    !STUDY_LEVELS.has(
      studyLevelRaw,
    )
  ) {
    fieldErrors.studyLevel =
      "المستوى الدراسي غير صالح.";
  }

  if (
    Object.keys(fieldErrors).length >
    0
  ) {
    return {
      success: false,
      message:
        "راجع البيانات المدخلة وحاول مرة أخرى.",
      fieldErrors,
    };
  }

  /* -------------------------
     UNIQUE STUDENT NUMBER
  ------------------------- */

  if (studentNumber) {
    const existingStudent =
      await prisma.user.findFirst({
        where: {
          studentNumber,
          id: {
            not: user.id,
          },
        },

        select: {
          id: true,
        },
      });

    if (existingStudent) {
      return {
        success: false,
        message:
          "الرقم الجامعي مستخدم في حساب آخر.",
        fieldErrors: {
          studentNumber:
            "هذا الرقم الجامعي مسجل مسبقًا.",
        },
      };
    }
  }

  try {
    await prisma.user.update({
      where: {
        id: user.id,
      },

      data: {
        name,

        studentNumber:
          studentNumber || null,

        phone:
          phone || null,

        studyLevel:
          studyLevelRaw
            ? (studyLevelRaw as StudyLevel)
            : null,
      },
    });

    revalidatePath("/student");

    return {
      success: true,
      message:
        "تم تحديث بياناتك بنجاح.",
      version:
        Date.now().toString(),
    };
  } catch (error) {
    if (
      error instanceof
        Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        success: false,
        message:
          "تعذر حفظ الرقم الجامعي لأنه مستخدم في حساب آخر.",
        fieldErrors: {
          studentNumber:
            "الرقم الجامعي مستخدم مسبقًا.",
        },
      };
    }

    console.error(
      "Student profile update error:",
      error,
    );

    return {
      success: false,
      message:
        "تعذر تحديث البيانات. حاول مرة أخرى.",
    };
  }
}

/* =========================================================
   AVATAR
========================================================= */

async function safeDeleteAvatar(
  storedName: string | null,
) {
  await tryDeleteUserImage(storedName, "avatars", "student-avatar");
}

export async function updateStudentAvatar(
  _previousState: StudentAvatarState,
  formData: FormData,
): Promise<StudentAvatarState> {
  const { user } =
    await requirePermission(
      PERMISSIONS.STUDENT_PROFILE_EDIT,
    );

  const file =
    formData.get("avatar");

  if (
    !(file instanceof File) ||
    file.size === 0
  ) {
    return {
      success: false,
      message:
        "اختر صورة أولًا.",
    };
  }

  const previous =
    await prisma.user.findUnique({
      where: {
        id: user.id,
      },

      select: {
        avatarStoredName: true,
      },
    });

  let uploaded: Awaited<ReturnType<typeof uploadUserImage>> | null = null;

  try {
    await enforceProfileUploadLimit(user.id, file.size);
    uploaded = await uploadUserImage(file, user.id, "avatar", MAX_AVATAR_SIZE);

    const updatedAt =
      new Date();

    await prisma.user.update({
      where: {
        id: user.id,
      },

      data: {
        avatarStoredName:
          uploaded.storedName,

        avatarOriginalName:
          uploaded.originalName,

        avatarMime:
          uploaded.mime,

        avatarSize:
          uploaded.size,

        avatarUpdatedAt:
          updatedAt,
      },
    });

    await safeDeleteAvatar(
      previous?.avatarStoredName ??
        null,
    );

    revalidatePath("/student");

    return {
      success: true,
      message:
        "تم تحديث الصورة الشخصية بنجاح.",
      version:
        updatedAt
          .getTime()
          .toString(),
    };
  } catch (error) {
    if (uploaded) await safeDeleteAvatar(uploaded.storedName);

    if (error instanceof UploadRateLimitError) {
      return { success: false, message: uploadRateLimitMessage(error) };
    }

    if (error instanceof UserMediaStorageError) {
      return { success: false, message: error.message };
    }

    console.error(
      "Student avatar upload error:",
      error,
    );

    return {
      success: false,
      message:
        "تعذر تحديث الصورة الشخصية. حاول مرة أخرى.",
    };
  }
}

export async function removeStudentAvatar(
  _previousState: StudentAvatarState,
  _formData: FormData,
): Promise<StudentAvatarState> {
  const { user } =
    await requirePermission(
      PERMISSIONS.STUDENT_PROFILE_EDIT,
    );

  const current =
    await prisma.user.findUnique({
      where: {
        id: user.id,
      },

      select: {
        avatarStoredName: true,
      },
    });

  await prisma.user.update({
    where: {
      id: user.id,
    },

    data: {
      avatarStoredName: null,
      avatarOriginalName: null,
      avatarMime: null,
      avatarSize: null,
      avatarUpdatedAt: null,
    },
  });

  await safeDeleteAvatar(
    current?.avatarStoredName ??
      null,
  );

  revalidatePath("/student");

  return {
    success: true,
    message:
      "تم حذف الصورة الشخصية.",
    removed: true,
    version:
      Date.now().toString(),
  };
}
/* =========================================================
   CANCEL ACTIVITY REGISTRATION
========================================================= */

export type CancelRegistrationState = {
  success: boolean;
  message: string;
};

export async function cancelActivityRegistration(
  _previousState: CancelRegistrationState,
  formData: FormData,
): Promise<CancelRegistrationState> {
  const { user } = await requirePermission(
    PERMISSIONS.ACTIVITY_CANCEL_OWN_REGISTRATION,
  );

  const submissionId = String(
    formData.get("submissionId") ?? "",
  ).trim();

  if (!submissionId) {
    return {
      success: false,
      message: "تعذر تحديد التسجيل المطلوب.",
    };
  }

  const submission =
    await prisma.activityFormSubmission.findFirst({
      where: {
        id: submissionId,
        userId: user.id,
      },

      select: {
        id: true,
        status: true,

        form: {
          select: {
            activity: {
              select: {
                id: true,
                title: true,
                startsAt: true,
              },
            },
          },
        },
      },
    });

  if (!submission) {
    return {
      success: false,
      message:
        "التسجيل غير موجود أو لا يخص حسابك.",
    };
  }

  const activity =
    submission.form.activity;

  if (
    submission.status === "REJECTED"
  ) {
    return {
      success: false,
      message:
        "لا يمكن إلغاء تسجيل مرفوض.",
    };
  }

  if (
    activity.startsAt <= new Date()
  ) {
    return {
      success: false,
      message:
        "لا يمكن إلغاء التسجيل بعد بدء النشاط.",
    };
  }

  try {
    const deleted =
      await prisma.activityFormSubmission.deleteMany({
        where: {
          id: submission.id,
          userId: user.id,
        },
      });

    if (deleted.count !== 1) {
      return {
        success: false,
        message:
          "تعذر إلغاء التسجيل. حاول مرة أخرى.",
      };
    }

    /*
     * ActivityFormAnswer مرتبط بالتسجيل
     * بـ onDelete: Cascade، لذلك تُحذف
     * إجابات التسجيل تلقائيًا.
     */

    revalidatePath("/student");
    revalidatePath("/activities");

    revalidatePath(
      `/activities/${activity.id}/register`,
    );

    revalidatePath(
      `/admin/activities/${activity.id}/registrations`,
    );

    revalidatePath(
      "/admin/activities",
    );

    return {
      success: true,
      message:
        "تم إلغاء تسجيلك في النشاط بنجاح.",
    };
  } catch (error) {
    console.error(
      "Cancel student registration error:",
      error,
    );

    return {
      success: false,
      message:
        "تعذر إلغاء التسجيل حاليًا. حاول مرة أخرى.",
    };
  }
}
