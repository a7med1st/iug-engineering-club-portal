"use server";

import {
  mkdir,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";
import type { StudyLevel } from "@prisma/client";
import { revalidatePath } from "next/cache";

import {
  PERMISSIONS,
  requirePermission,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

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

function isValidImageSignature(
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

function avatarDirectory() {
  return path.join(
    process.cwd(),
    "storage",
    "avatars",
  );
}

async function safeDeleteAvatar(
  storedName: string | null,
) {
  if (!storedName) {
    return;
  }

  const safeName =
    path.basename(storedName);

  try {
    await unlink(
      path.join(
        avatarDirectory(),
        safeName,
      ),
    );
  } catch {
    // عدم وجود الملف القديم لا يفشل العملية.
  }
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

  if (
    file.size >
    MAX_AVATAR_SIZE
  ) {
    return {
      success: false,
      message:
        "حجم الصورة يجب ألا يتجاوز 5MB.",
    };
  }

  if (
    !ALLOWED_MIME_TYPES.has(
      file.type,
    )
  ) {
    return {
      success: false,
      message:
        "الصيغ المسموحة هي JPG وPNG وWebP فقط.",
    };
  }

  const buffer = Buffer.from(
    await file.arrayBuffer(),
  );

  if (
    !isValidImageSignature(
      new Uint8Array(buffer),
      file.type,
    )
  ) {
    return {
      success: false,
      message:
        "الملف المحدد لا يبدو كصورة صالحة.",
    };
  }

  const extension =
    EXTENSIONS[file.type];

  const storedName =
    `${randomUUID()}${extension}`;

  const directory =
    avatarDirectory();

  await mkdir(directory, {
    recursive: true,
  });

  const previous =
    await prisma.user.findUnique({
      where: {
        id: user.id,
      },

      select: {
        avatarStoredName: true,
      },
    });

  try {
    await writeFile(
      path.join(
        directory,
        storedName,
      ),
      buffer,
      {
        flag: "wx",
      },
    );

    const updatedAt =
      new Date();

    await prisma.user.update({
      where: {
        id: user.id,
      },

      data: {
        avatarStoredName:
          storedName,

        avatarOriginalName:
          file.name.slice(0, 255),

        avatarMime:
          file.type,

        avatarSize:
          file.size,

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
    await safeDeleteAvatar(
      storedName,
    );

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