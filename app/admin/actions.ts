"use server";

import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { activityDateTimeFromInput } from "@/lib/activities";
import { tryDeleteActivityImages } from "@/lib/activity-image-storage";
import {
  getEmailValidationMessage,
  validateEmail,
} from "@/lib/email-validation";
import {
  createInitialEmailVerificationCode,
  invalidateUndeliveredVerificationCode,
} from "@/lib/email-verification";
import {
  assertEmailDeliveryConfigured,
  sendEmailVerificationCode,
} from "@/lib/mail";
import {
  PERMISSIONS,
  canAccessActivityDepartments,
  canAccessDepartment,
  isDepartmentScopedPermission,
  normalizeMemberPermissions,
  requirePermission,
} from "@/lib/permissions";

/* =========================================================
   ACTIVITY CONSTANTS
========================================================= */

const activityStatuses = [
  "DRAFT",
  "PUBLISHED",
  "ARCHIVED",
] as const;

type ActivityStatusInput =
  (typeof activityStatuses)[number];

const activityQuestionTypes = [
  "SHORT_TEXT",
  "LONG_TEXT",
  "EMAIL",
  "PHONE",
  "NUMBER",
  "SELECT",
  "RADIO",
  "CHECKBOX",
] as const;

type ActivityQuestionTypeInput =
  (typeof activityQuestionTypes)[number];

type RegistrationQuestionInput = {
  label: string;
  type: ActivityQuestionTypeInput;
  required: boolean;
  placeholder: string;
  helpText: string;
  options: string[];
  sortOrder: number;
};

/* =========================================================
   ERROR
========================================================= */

class AdminActionError extends Error {}

/* =========================================================
   HELPERS
========================================================= */

function requiredText(
  formData: FormData,
  field: string,
  label: string,
) {
  const value = String(
    formData.get(field) ?? "",
  ).trim();

  if (!value) {
    throw new AdminActionError(
      `${label} مطلوب.`,
    );
  }

  return value;
}

function optionalId(
  formData: FormData,
  field: string,
) {
  return (
    String(
      formData.get(field) ?? "",
    ).trim() || null
  );
}

async function ensureDepartmentExists(
  departmentId: string | null,
) {
  if (!departmentId) return;

  const department =
    await prisma.department.findUnique({
      where: {
        id: departmentId,
      },

      select: {
        id: true,
      },
    });

  if (!department) {
    throw new AdminActionError(
      "القسم المحدد غير موجود.",
    );
  }
}

/* =========================================================
   REGISTRATION QUESTIONS PARSER
========================================================= */

function parseRegistrationQuestions(
  formData: FormData,
): RegistrationQuestionInput[] {
  const raw = String(
    formData.get(
      "registrationQuestions",
    ) ?? "[]",
  ).trim();

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw || "[]");
  } catch {
    throw new AdminActionError(
      "تعذر قراءة أسئلة نموذج التسجيل.",
    );
  }

  if (!Array.isArray(parsed)) {
    throw new AdminActionError(
      "بيانات أسئلة التسجيل غير صالحة.",
    );
  }

  if (parsed.length > 50) {
    throw new AdminActionError(
      "لا يمكن إضافة أكثر من 50 سؤالًا للنشاط.",
    );
  }

  return parsed.map(
    (item, index) => {
      if (
        !item ||
        typeof item !== "object"
      ) {
        throw new AdminActionError(
          `السؤال رقم ${
            index + 1
          } غير صالح.`,
        );
      }

      const question =
        item as Record<
          string,
          unknown
        >;

      const label = String(
        question.label ?? "",
      ).trim();

      const type = String(
        question.type ?? "",
      ).trim();

      const placeholder = String(
        question.placeholder ?? "",
      ).trim();

      const helpText = String(
        question.helpText ?? "",
      ).trim();

      const required =
        question.required === true;

      /* -----------------------------------------
         LABEL
      ----------------------------------------- */

      if (!label) {
        throw new AdminActionError(
          `اكتب نص السؤال رقم ${
            index + 1
          }.`,
        );
      }

      if (label.length > 250) {
        throw new AdminActionError(
          `نص السؤال رقم ${
            index + 1
          } طويل جدًا.`,
        );
      }

      /* -----------------------------------------
         TYPE
      ----------------------------------------- */

      if (
        !activityQuestionTypes.includes(
          type as ActivityQuestionTypeInput,
        )
      ) {
        throw new AdminActionError(
          `نوع السؤال رقم ${
            index + 1
          } غير صالح.`,
        );
      }

      const typedType =
        type as ActivityQuestionTypeInput;

      /* -----------------------------------------
         PLACEHOLDER
      ----------------------------------------- */

      if (placeholder.length > 250) {
        throw new AdminActionError(
          `النص الإرشادي للسؤال رقم ${
            index + 1
          } طويل جدًا.`,
        );
      }

      /* -----------------------------------------
         HELP TEXT
      ----------------------------------------- */

      if (helpText.length > 500) {
        throw new AdminActionError(
          `الملاحظة التوضيحية للسؤال رقم ${
            index + 1
          } طويلة جدًا.`,
        );
      }

      /* -----------------------------------------
         OPTIONS
      ----------------------------------------- */

      let options: string[] = [];

      if (
        Array.isArray(
          question.options,
        )
      ) {
        options = question.options
          .map((option) =>
            String(option).trim(),
          )
          .filter(Boolean);
      }

      const usesOptions =
        typedType === "SELECT" ||
        typedType === "RADIO" ||
        typedType === "CHECKBOX";

      if (usesOptions) {
        if (options.length < 2) {
          throw new AdminActionError(
            `السؤال رقم ${
              index + 1
            } يحتاج إلى خيارين على الأقل.`,
          );
        }

        if (options.length > 30) {
          throw new AdminActionError(
            `السؤال رقم ${
              index + 1
            } يحتوي على خيارات كثيرة جدًا.`,
          );
        }

        if (
          options.some(
            (option) =>
              option.length > 200,
          )
        ) {
          throw new AdminActionError(
            `يوجد خيار طويل جدًا في السؤال رقم ${
              index + 1
            }.`,
          );
        }

        const uniqueOptions =
          new Set(
            options.map((option) =>
              option.toLocaleLowerCase(),
            ),
          );

        if (
          uniqueOptions.size !==
          options.length
        ) {
          throw new AdminActionError(
            `يوجد خيار مكرر في السؤال رقم ${
              index + 1
            }.`,
          );
        }
      } else {
        /*
          الأنواع النصية لا تحتاج Options
        */
        options = [];
      }

      return {
        label,
        type: typedType,
        required,
        placeholder,
        helpText,
        options,

        /*
          لا نثق في sortOrder القادم من
          المتصفح، بل نعتمد ترتيب المصفوفة.
        */
        sortOrder: index,
      };
    },
  );
}

/* =========================================================
   RUN ADMIN ACTION
========================================================= */

async function runAdminAction(
  path: string,
  successMessage: string,
  fallbackError: string,
  action: () => Promise<void>,
): Promise<never> {
  try {
    await action();
  } catch (error) {
    const message =
      error instanceof
      AdminActionError
        ? error.message
        : fallbackError;

    redirect(
      `${path}?error=${encodeURIComponent(
        message,
      )}`,
    );
  }

  redirect(
    `${path}?success=${encodeURIComponent(
      successMessage,
    )}`,
  );
}

function readMemberPermissions(
  formData: FormData,
) {
  return normalizeMemberPermissions(
    formData
      .getAll("permissions")
      .map((value) =>
        String(value).trim(),
      ),
  );
}

function ensureMemberDepartmentForPermissions(
  departmentId: string | null,
  permissions: ReturnType<
    typeof readMemberPermissions
  >,
) {
  const needsDepartment =
    permissions.some(
      isDepartmentScopedPermission,
    );

  if (
    needsDepartment &&
    !departmentId
  ) {
    throw new AdminActionError(
      "الصلاحيات المرتبطة بالقسم تحتاج إلى تحديد قسم للعضو.",
    );
  }
}

/* =========================================================
   CREATE MEMBER
========================================================= */

export async function createMember(
  formData: FormData,
) {
  await requirePermission(
    PERMISSIONS.MEMBER_MANAGE,
  );

  return runAdminAction(
    "/admin/members",
    "تم إنشاء حساب العضو وإرسال رمز التحقق إلى بريده بنجاح.",
    "تعذر إنشاء حساب العضو. تحقق من البيانات وحاول مجددًا.",

    async () => {
      const name = requiredText(
        formData,
        "name",
        "الاسم",
      );

      const emailResult = validateEmail(
        requiredText(
          formData,
          "email",
          "البريد الإلكتروني",
        ),
      );

      if (!emailResult.valid) {
        throw new AdminActionError(
          getEmailValidationMessage(
            emailResult,
          ) ??
            "يرجى إدخال بريد إلكتروني صحيح.",
        );
      }

      const email = emailResult.email;

      const password = String(
        formData.get("password") ?? "",
      );

      const position =
        String(
          formData.get(
            "position",
          ) ?? "",
        ).trim() || null;

      const departmentId =
        optionalId(
          formData,
          "departmentId",
        );

      const memberPermissions =
        readMemberPermissions(
          formData,
        );

      const requestedRole =
        String(
          formData.get("role") ??
            "MEMBER",
        );

      if (
        name.length < 2 ||
        name.length > 120
      ) {
        throw new AdminActionError(
          "يجب أن يكون الاسم بين حرفين و120 حرفًا.",
        );
      }

      if (password.length < 8 || password.length > 128) {
        throw new AdminActionError(
          "يجب أن تكون كلمة المرور بين 8 و128 حرفًا.",
        );
      }

      if (
        requestedRole !== "MEMBER"
      ) {
        throw new AdminActionError(
          "هذه الصفحة مخصصة لإنشاء حسابات الأعضاء فقط.",
        );
      }

      await ensureDepartmentExists(
        departmentId,
      );

      ensureMemberDepartmentForPermissions(
        departmentId,
        memberPermissions,
      );

      const existingUser =
        await prisma.user.findFirst({
          where: {
            email: {
              equals: email,
              mode: "insensitive",
            },
          },

          select: {
            id: true,
          },
        });

      if (existingUser) {
        throw new AdminActionError(
          "هذا البريد الإلكتروني مستخدم بالفعل.",
        );
      }

      const passwordHash =
        await bcrypt.hash(
          password,
          12,
        );

      try {
        assertEmailDeliveryConfigured();
      } catch {
        throw new AdminActionError(
          "خدمة إرسال البريد غير مهيأة. لم يتم إنشاء حساب العضو.",
        );
      }

      let registration:
        | {
            user: {
              id: string;
              email: string;
              name: string;
            };
            verification: {
              code: string;
              codeHash: string;
            };
          }
        | undefined;

      try {
        registration =
          await prisma.$transaction(
            async (transaction) => {
              const user =
                await transaction.user.create({
                  data: {
                    name,
                    email,
                    emailVerifiedAt: null,
                    passwordHash,
                    role: "MEMBER",
                    mustChangePassword: true,
                    position,
                    departmentId,
                    memberPermissions,
                  },
                  select: {
                    id: true,
                    email: true,
                    name: true,
                  },
                });

              const verification =
                await createInitialEmailVerificationCode(
                  transaction,
                  user.id,
                );

              return { user, verification };
            },
          );
      } catch (error) {
        if (
          error instanceof
            Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          throw new AdminActionError(
            "هذا البريد الإلكتروني مستخدم بالفعل.",
          );
        }

        throw error;
      }

      try {
        await sendEmailVerificationCode({
          email: registration.user.email,
          name: registration.user.name,
          code: registration.verification.code,
        });
      } catch {
        await invalidateUndeliveredVerificationCode(
          registration.user.id,
          registration.verification.codeHash,
        );

        revalidatePath("/admin/members");

        throw new AdminActionError(
          "تم إنشاء حساب العضو، لكن تعذر إرسال رمز التحقق. يمكن للعضو طلب رمز جديد عند محاولة تسجيل الدخول.",
        );
      }

      revalidatePath(
        "/admin/members",
      );
    },
  );
}

/* =========================================================
   UPDATE MEMBER ACCESS
========================================================= */

export async function updateMemberAccess(
  formData: FormData,
) {
  await requirePermission(
    PERMISSIONS.MEMBER_MANAGE,
  );

  return runAdminAction(
    "/admin/members",

    "تم تحديث قسم العضو وصلاحياته بنجاح.",

    "تعذر تحديث صلاحيات العضو.",

    async () => {
      const memberId =
        requiredText(
          formData,
          "memberId",
          "معرّف العضو",
        );

      const position =
        String(
          formData.get(
            "position",
          ) ?? "",
        ).trim() || null;

      const departmentId =
        optionalId(
          formData,
          "departmentId",
        );

      const memberPermissions =
        readMemberPermissions(
          formData,
        );

      await ensureDepartmentExists(
        departmentId,
      );

      ensureMemberDepartmentForPermissions(
        departmentId,
        memberPermissions,
      );

      const member =
        await prisma.user.findUnique({
          where: {
            id: memberId,
          },

          select: {
            id: true,
            role: true,
            departmentId: true,
            memberPermissions: true,
          },
        });

      if (
        !member ||
        member.role !== "MEMBER"
      ) {
        throw new AdminActionError(
          "حساب العضو غير موجود.",
        );
      }

      const previousPermissions = [...member.memberPermissions].sort();
      const nextPermissions = [...memberPermissions].sort();
      const accessChanged =
        member.departmentId !== departmentId ||
        previousPermissions.length !== nextPermissions.length ||
        previousPermissions.some(
          (permission, index) => permission !== nextPermissions[index],
        );

      await prisma.user.update({
        where: {
          id: memberId,
        },

        data: {
          position,
          departmentId,
          memberPermissions,
          ...(accessChanged
            ? { sessionVersion: { increment: 1 } }
            : {}),
        },
      });

      revalidatePath(
        "/admin/members",
      );

      revalidatePath(
        "/member",
      );

      revalidatePath(
        "/member/check-in",
      );
    },
  );
}

/* =========================================================
   CREATE ACTIVITY
========================================================= */

export async function createActivity(
  formData: FormData,
) {
  const { user } =
    await requirePermission(
      PERMISSIONS.ACTIVITY_MANAGE,
    );

  return runAdminAction(
    "/admin/activities",

    "تم حفظ النشاط ونموذج التسجيل بنجاح.",

    "تعذر حفظ النشاط. تحقق من البيانات وحاول مجددًا.",

    async () => {
      /* =============================================
         ACTIVITY DATA
      ============================================= */

      const title = requiredText(
        formData,
        "title",
        "اسم النشاط",
      );

      const description =
        requiredText(
          formData,
          "description",
          "وصف النشاط",
        );

      const location = requiredText(
        formData,
        "location",
        "مكان النشاط",
      );

      const startDate = requiredText(
        formData,
        "startDate",
        "تاريخ بداية النشاط",
      );

      const startTime = requiredText(
        formData,
        "startTime",
        "وقت بداية النشاط",
      );

      const startsAt = activityDateTimeFromInput(
        startDate,
        startTime,
      );

      const endDate = String(formData.get("endDate") ?? "").trim();
      const endTime = String(formData.get("endTime") ?? "").trim();

      if (Boolean(endDate) !== Boolean(endTime)) {
        throw new AdminActionError(
          "أدخل تاريخ ووقت نهاية النشاط معًا، أو اترك الحقلين فارغين.",
        );
      }

      const endsAt = endDate && endTime
        ? activityDateTimeFromInput(endDate, endTime)
        : null;

      const capacity = Number(
        formData.get("capacity"),
      );

      const statusValue = String(
        formData.get("status") ??
          "PUBLISHED",
      ).trim();

      /* =============================================
         REGISTRATION FORM
      ============================================= */

      const registrationFormTitle =
        String(
          formData.get(
            "registrationFormTitle",
          ) ?? "",
        ).trim() ||
        "نموذج التسجيل";

      const registrationFormDescription =
        String(
          formData.get(
            "registrationFormDescription",
          ) ?? "",
        ).trim();

      const registrationFormIsOpen =
        formData.get(
          "registrationFormIsOpen",
        ) === "on";

      const registrationQuestions =
        parseRegistrationQuestions(
          formData,
        );

      /* =============================================
         DEPARTMENTS
      ============================================= */

      const requestedDepartmentIds =
        [
          ...new Set(
            formData
              .getAll(
                "departmentIds",
              )
              .map((value) =>
                String(
                  value,
                ).trim(),
              )
              .filter(Boolean),
          ),
        ];

      /* =============================================
         VALIDATE ACTIVITY
      ============================================= */

      if (title.length > 160) {
        throw new AdminActionError(
          "اسم النشاط طويل جدًا.",
        );
      }

      if (
        description.length >
        10_000
      ) {
        throw new AdminActionError(
          "وصف النشاط طويل جدًا.",
        );
      }

      if (
        location.length > 250
      ) {
        throw new AdminActionError(
          "اسم مكان النشاط طويل جدًا.",
        );
      }

      if (!startsAt) {
        throw new AdminActionError(
          "تاريخ أو وقت بداية النشاط غير صالح.",
        );
      }

      if (endDate && endTime && !endsAt) {
        throw new AdminActionError(
          "تاريخ أو وقت نهاية النشاط غير صالح.",
        );
      }

      if (endsAt && endsAt.getTime() <= startsAt.getTime()) {
        throw new AdminActionError(
          "يجب أن يكون موعد نهاية النشاط بعد موعد البداية.",
        );
      }

      if (
        !Number.isInteger(capacity) ||
        capacity < 1 ||
        capacity > 100_000
      ) {
        throw new AdminActionError(
          "السعة الطلابية يجب أن تكون رقمًا صحيحًا موجبًا.",
        );
      }

      if (
        !activityStatuses.includes(
          statusValue as ActivityStatusInput,
        )
      ) {
        throw new AdminActionError(
          "حالة النشاط غير صالحة.",
        );
      }

      /* =============================================
         VALIDATE FORM
      ============================================= */

      if (
        registrationFormTitle.length >
        160
      ) {
        throw new AdminActionError(
          "عنوان نموذج التسجيل طويل جدًا.",
        );
      }

      if (
        registrationFormDescription.length >
        3000
      ) {
        throw new AdminActionError(
          "وصف نموذج التسجيل طويل جدًا.",
        );
      }

      /* =============================================
         VALIDATE DEPARTMENTS
      ============================================= */

      if (
        requestedDepartmentIds.length ===
        0
      ) {
        throw new AdminActionError(
          "اختر قسمًا واحدًا على الأقل أو اختر جميع الأقسام.",
        );
      }

      const selectAll =
        requestedDepartmentIds.includes(
          "all",
        );

      const explicitDepartmentIds =
        requestedDepartmentIds.filter(
          (departmentId) =>
            departmentId !== "all",
        );

      const availableDepartments =
        await prisma.department.findMany(
          {
            select: {
              id: true,
            },
          },
        );

      const availableDepartmentIds =
        new Set(
          availableDepartments.map(
            ({ id }) => id,
          ),
        );

      if (
        availableDepartments.length ===
          0 ||
        explicitDepartmentIds.some(
          (departmentId) =>
            !availableDepartmentIds.has(
              departmentId,
            ),
        )
      ) {
        throw new AdminActionError(
          "يتضمن اختيار الأقسام قسمًا غير موجود.",
        );
      }

      /*
        النشاط العام لا يحتاج صفوف
        ActivityDepartment.

        بذلك يبقى عامًا حتى إذا تمت
        إضافة أقسام جديدة مستقبلًا.
      */

      const departmentIds =
        selectAll
          ? []
          : explicitDepartmentIds;

      if (
        user.role === "MEMBER"
      ) {
        if (
          !user.departmentId ||
          selectAll ||
          departmentIds.length !==
            1 ||
          departmentIds[0] !==
            user.departmentId
        ) {
          throw new AdminActionError(
            "يمكنك إنشاء نشاط لقسمك فقط.",
          );
        }
      }

      /* =============================================
         CREATE EVERYTHING
      ============================================= */

      const activity = await prisma.activity.create({
        data: {
          title,
          description,
          location,
          startsAt,
          endsAt,
          capacity,

          /*
            Google Forms لم يعد مستخدمًا
            في الأنشطة الجديدة.
          */
          formUrl: null,

          status:
            statusValue as ActivityStatusInput,

          /* -----------------------------------------
             DEPARTMENTS
          ----------------------------------------- */

          departments:
            departmentIds.length > 0
              ? {
                  create:
                    departmentIds.map(
                      (
                        departmentId,
                      ) => ({
                        department: {
                          connect: {
                            id: departmentId,
                          },
                        },
                      }),
                    ),
                }
              : undefined,

          /* -----------------------------------------
             INTERNAL REGISTRATION FORM
          ----------------------------------------- */

          registrationForm: {
            create: {
              title:
                registrationFormTitle,

              description:
                registrationFormDescription,

              isOpen:
                registrationFormIsOpen,

              /* -------------------------------------
                 QUESTIONS
              ------------------------------------- */

              questions:
                registrationQuestions.length >
                0
                  ? {
                      create:
                        registrationQuestions.map(
                          (
                            question,
                          ) => ({
                            label:
                              question.label,

                            type:
                              question.type,

                            required:
                              question.required,

                            placeholder:
                              question.placeholder ||
                              null,

                            helpText:
                              question.helpText ||
                              null,

                            options:
                              question
                                .options
                                .length >
                              0
                                ? question.options
                                : undefined,

                            sortOrder:
                              question.sortOrder,
                          }),
                        ),
                    }
                  : undefined,
            },
          },
        },
      });

      /*
       * Notify students when a new activity is published.
       * General activity => all students.
       * Department activity => students in the selected departments.
       */
      if (
        statusValue === "PUBLISHED"
      ) {
        const students =
          await prisma.user.findMany({
            where: {
              role: "STUDENT",

              ...(departmentIds.length > 0
                ? {
                    departmentId: {
                      in: departmentIds,
                    },
                  }
                : {}),
            },

            select: {
              id: true,
            },
          });

        if (students.length > 0) {
          const activityDate =
            new Intl.DateTimeFormat(
              "ar-PS",
              {
                dateStyle: "medium",
                timeStyle: "short",
              },
            ).format(startsAt);

          await prisma.notification.createMany({
            data: students.map(
              (student) => ({
                userId:
                  student.id,

                type:
                  "ACTIVITY_NEW",

                title:
                  `نشاط جديد: ${title}`,

                body:
                  `${activityDate} · ${location}`,

                href:
                  `/activities/${activity.id}/register`,
              }),
            ),
          });
        }
      }

      /* =============================================
         REVALIDATE
      ============================================= */

      revalidatePath("/");
      revalidatePath(
        "/admin/activities",
      );
      revalidatePath(
        "/activities",
      );

      revalidatePath(
        "/notifications",
      );
    },
  );
}

/* =========================================================
   DELETE ACTIVITY
========================================================= */

export async function deleteActivity(
  formData: FormData,
) {
  const { user } =
    await requirePermission(
      PERMISSIONS.ACTIVITY_MANAGE,
    );

  return runAdminAction(
    "/admin/activities",

    "تم حذف النشاط.",

    "تعذر حذف النشاط.",

    async () => {
      const id = requiredText(
        formData,
        "id",
        "معرّف النشاط",
      );

      const activity =
        await prisma.activity.findUnique({
          where: {
            id,
          },

          select: {
            coverImagePathname: true,

            images: {
              select: {
                pathname: true,
              },
            },

            departments: {
              select: {
                departmentId:
                  true,
              },
            },
          },
        });

      if (
        !activity ||
        !canAccessActivityDepartments(
          user,
          activity.departments.map(
            (item) =>
              item.departmentId,
          ),
        )
      ) {
        throw new AdminActionError(
          "ليس لديك صلاحية لحذف هذا النشاط.",
        );
      }

      await prisma.activity.delete({
        where: {
          id,
        },
      });

      await tryDeleteActivityImages(
        [
          activity.coverImagePathname,
          ...activity.images.map(({ pathname }) => pathname),
        ],
        "delete-activity",
      );

      revalidatePath("/");
      revalidatePath(
        "/admin/activities",
      );
      revalidatePath(
        "/activities",
      );
    },
  );
}

/* =========================================================
   SAVE GUIDE
========================================================= */

export async function saveGuide(
  formData: FormData,
) {
  const { user } =
    await requirePermission(
      PERMISSIONS.GUIDE_MANAGE,
    );

  return runAdminAction(
    "/admin/guides",

    "تم حفظ دليل القسم.",

    "تعذر حفظ دليل القسم.",

    async () => {
      const departmentId =
        requiredText(
          formData,
          "departmentId",
          "القسم",
        );

      if (
        !canAccessDepartment(
          user,
          departmentId,
        )
      ) {
        throw new AdminActionError(
          "يمكنك تعديل دليل قسمك فقط.",
        );
      }

      const department =
        await prisma.department.findUnique(
          {
            where: {
              id: departmentId,
            },

            select: {
              slug: true,
            },
          },
        );

      if (!department) {
        throw new AdminActionError(
          "القسم المحدد غير موجود.",
        );
      }

      const content = {
        overview: String(
          formData.get(
            "overview",
          ) ?? "",
        ).trim(),

        fitFor: String(
          formData.get(
            "fitFor",
          ) ?? "",
        ).trim(),

        careersIncome: String(
          formData.get(
            "careersIncome",
          ) ?? "",
        ).trim(),

        skillsCourses: String(
          formData.get(
            "skillsCourses",
          ) ?? "",
        ).trim(),

        comparisons: String(
          formData.get(
            "comparisons",
          ) ?? "",
        ).trim(),

        faq: String(
          formData.get("faq") ??
            "",
        ).trim(),
      };

      await prisma.departmentGuide.upsert(
        {
          where: {
            departmentId,
          },

          create: {
            departmentId,
            ...content,
          },

          update: content,
        },
      );

      revalidatePath(
        "/admin/guides",
      );

      revalidatePath(
        "/departments",
      );

      revalidatePath(
        `/departments/${department.slug}`,
      );
    },
  );
}

/* =========================================================
   ADD STRUCTURE ITEM
========================================================= */

export async function addStructureItem(
  formData: FormData,
) {
  const { user } =
    await requirePermission(
      PERMISSIONS.STRUCTURE_MANAGE,
    );

  return runAdminAction(
    "/admin/structure",

    "تمت إضافة العنصر إلى الهيكلية.",

    "تعذر إضافة العنصر إلى الهيكلية.",

    async () => {
      const name = requiredText(
        formData,
        "name",
        "اسم الشخص",
      );

      const title = requiredText(
        formData,
        "title",
        "المنصب",
      );

      const departmentId =
        optionalId(
          formData,
          "departmentId",
        );

      if (
        name.length > 120 ||
        title.length > 160
      ) {
        throw new AdminActionError(
          "الاسم أو المنصب طويل جدًا.",
        );
      }

      await ensureDepartmentExists(
        departmentId,
      );

      if (
        user.role === "MEMBER" &&
        (
          !departmentId ||
          !canAccessDepartment(
            user,
            departmentId,
          )
        )
      ) {
        throw new AdminActionError(
          "يمكنك إضافة عناصر إلى هيكلية قسمك فقط.",
        );
      }

      await prisma.clubStructureItem.create(
        {
          data: {
            name,
            title,
            departmentId,
          },
        },
      );

      revalidatePath(
        "/admin/structure",
      );

      revalidatePath(
        "/delegates",
      );
    },
  );
}
