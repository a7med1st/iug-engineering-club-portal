"use server";

import {
  Prisma,
  type ActivityFormQuestionType,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

import {
  PERMISSIONS,
  requirePermission,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export type RegistrationFormState = {
  success: boolean;
  message: string;
};

const initialFailure: RegistrationFormState = {
  success: false,
  message: "",
};

function isOptionQuestion(
  type: ActivityFormQuestionType,
) {
  return (
    type === "SELECT" ||
    type === "RADIO" ||
    type === "CHECKBOX"
  );
}

function getQuestionOptions(
  options: Prisma.JsonValue | null,
): string[] {
  if (!Array.isArray(options)) {
    return [];
  }

  return options.filter(
    (item): item is string =>
      typeof item === "string",
  );
}

function validateAndGetAnswer(
  question: {
    id: string;
    label: string;
    type: ActivityFormQuestionType;
    required: boolean;
    options: Prisma.JsonValue | null;
  },
  formData: FormData,
): Prisma.InputJsonValue | null {
  const fieldName =
    `question_${question.id}`;

  /*
   * CHECKBOX
   */
  if (question.type === "CHECKBOX") {
    const submittedValues = formData
      .getAll(fieldName)
      .map((value) =>
        String(value).trim(),
      )
      .filter(Boolean);

    if (
      question.required &&
      submittedValues.length === 0
    ) {
      throw new Error(
        `السؤال "${question.label}" مطلوب.`,
      );
    }

    const allowedOptions =
      getQuestionOptions(
        question.options,
      );

    const invalidOption =
      submittedValues.some(
        (value) =>
          !allowedOptions.includes(
            value,
          ),
      );

    if (invalidOption) {
      throw new Error(
        `تم إرسال خيار غير صالح في السؤال "${question.label}".`,
      );
    }

    /*
     * السؤال الاختياري وغير المجاب
     * لا نحتاج لتخزين Answer له.
     */
    if (
      submittedValues.length === 0
    ) {
      return null;
    }

    return submittedValues;
  }

  /*
   * باقي الأنواع
   */
  const value = String(
    formData.get(fieldName) ?? "",
  ).trim();

  if (
    question.required &&
    !value
  ) {
    throw new Error(
      `السؤال "${question.label}" مطلوب.`,
    );
  }

  if (!value) {
    return null;
  }

  /*
   * SELECT / RADIO
   */
  if (isOptionQuestion(question.type)) {
    const allowedOptions =
      getQuestionOptions(
        question.options,
      );

    if (
      !allowedOptions.includes(value)
    ) {
      throw new Error(
        `تم إرسال خيار غير صالح في السؤال "${question.label}".`,
      );
    }
  }

  /*
   * EMAIL
   */
  if (
    question.type === "EMAIL" &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      value,
    )
  ) {
    throw new Error(
      `أدخل بريدًا إلكترونيًا صالحًا في السؤال "${question.label}".`,
    );
  }

  /*
   * NUMBER
   */
  if (
    question.type === "NUMBER" &&
    !Number.isFinite(
      Number(value),
    )
  ) {
    throw new Error(
      `أدخل رقمًا صالحًا في السؤال "${question.label}".`,
    );
  }

  /*
   * حماية من نصوص ضخمة بشكل غير منطقي.
   */
  if (value.length > 10_000) {
    throw new Error(
      `الإجابة على السؤال "${question.label}" طويلة جدًا.`,
    );
  }

  return value;
}

export async function submitActivityRegistration(
  _previousState: RegistrationFormState =
    initialFailure,
  formData: FormData,
): Promise<RegistrationFormState> {
  /*
   * سيحوّل المستخدم إلى صفحة Login
   * لو مش Student.
   */
  const { user } =
    await requirePermission(
      PERMISSIONS.ACTIVITY_REGISTER,
    );

  const activityId = String(
    formData.get("activityId") ??
      "",
  ).trim();

  const formId = String(
    formData.get("formId") ?? "",
  ).trim();

  if (!activityId || !formId) {
    return {
      success: false,
      message:
        "بيانات نموذج التسجيل غير مكتملة.",
    };
  }

  try {
    /*
     * نجيب النموذج والأسئلة من السيرفر.
     * لا نثق بالأسئلة القادمة من المتصفح.
     */
    const form =
      await prisma.activityRegistrationForm.findUnique({
        where: {
          id: formId,
        },

        include: {
          activity: {
            select: {
              id: true,
              title: true,
              capacity: true,
              status: true,
            },
          },

          questions: {
            orderBy: {
              sortOrder: "asc",
            },
          },
        },
      });

    if (
      !form ||
      form.activityId !==
        activityId ||
      form.activity.id !==
        activityId
    ) {
      return {
        success: false,
        message:
          "نموذج التسجيل غير موجود أو لا يتبع لهذا النشاط.",
      };
    }

    if (
      form.activity.status !==
      "PUBLISHED"
    ) {
      return {
        success: false,
        message:
          "هذا النشاط غير متاح للتسجيل حاليًا.",
      };
    }

    if (!form.isOpen) {
      return {
        success: false,
        message:
          "التسجيل في هذا النشاط مغلق.",
      };
    }

    /*
     * نتحقق من الإجابات قبل بدء عملية الحفظ.
     */
    const answers =
      form.questions
        .map((question) => {
          const value =
            validateAndGetAnswer(
              question,
              formData,
            );

          if (value === null) {
            return null;
          }

          return {
            questionId:
              question.id,
            value,
          };
        })
        .filter(
          (
            answer,
          ): answer is {
            questionId: string;
            value: Prisma.InputJsonValue;
          } => answer !== null,
        );

    /*
     * محاولة الحفظ داخل Transaction.
     *
     * Serializable تقلل مشكلة أن طالبين
     * يأخذوا آخر مقعد بنفس اللحظة.
     */
    const maxAttempts = 3;

    for (
      let attempt = 1;
      attempt <= maxAttempts;
      attempt++
    ) {
      try {
        await prisma.$transaction(
          async (tx) => {
            /*
             * هل سجل الطالب من قبل؟
             */
            const existing =
              await tx.activityFormSubmission.findFirst({
                where: {
                  formId:
                    form.id,
                  userId:
                    user.id,
                },

                select: {
                  id: true,
                },
              });

            if (existing) {
              throw new Error(
                "ALREADY_REGISTERED",
              );
            }

            /*
             * تأكد مرة ثانية أن الفورم
             * لم يتم إغلاقه أثناء تعبئة الطالب.
             */
            const latestForm =
              await tx.activityRegistrationForm.findUnique({
                where: {
                  id: form.id,
                },

                select: {
                  isOpen: true,

                  activity: {
                    select: {
                      capacity:
                        true,
                      status:
                        true,
                    },
                  },
                },
              });

            if (
              !latestForm ||
              !latestForm.isOpen
            ) {
              throw new Error(
                "REGISTRATION_CLOSED",
              );
            }

            if (
              latestForm.activity
                .status !==
              "PUBLISHED"
            ) {
              throw new Error(
                "ACTIVITY_NOT_AVAILABLE",
              );
            }

            /*
             * فحص السعة داخل نفس Transaction.
             */
const currentCount =
  await tx.activityFormSubmission.count({
    where: {
      formId: form.id,

      status: {
        not: "REJECTED",
      },
    },
  });

            if (
              latestForm.activity
                .capacity > 0 &&
              currentCount >=
                latestForm.activity
                  .capacity
            ) {
              throw new Error(
                "CAPACITY_FULL",
              );
            }

            /*
             * إنشاء التسجيل والإجابات.
             */
            await tx.activityFormSubmission.create({
              data: {
                formId:
                  form.id,

                userId:
                  user.id,

                studentName:
                  user.name,

                studentEmail:
                  user.email,

                studentDepartment:
                  user.department
                    ?.nameAr ??
                  null,

                answers:
                  answers.length >
                  0
                    ? {
                        create:
                          answers.map(
                            (
                              answer,
                            ) => ({
                              questionId:
                                answer.questionId,

                              value:
                                answer.value,
                            }),
                          ),
                      }
                    : undefined,
              },
            });
          },

          {
            isolationLevel:
              Prisma.TransactionIsolationLevel
                .Serializable,
          },
        );

        /*
         * إذا نجح الحفظ نخرج من Retry Loop.
         */
        break;
      } catch (error) {
        /*
         * رسائل business logic
         */
        if (
          error instanceof Error
        ) {
          if (
            error.message ===
            "ALREADY_REGISTERED"
          ) {
            return {
              success: false,
              message:
                "أنت مسجل مسبقًا في هذا النشاط.",
            };
          }

          if (
            error.message ===
            "REGISTRATION_CLOSED"
          ) {
            return {
              success: false,
              message:
                "تم إغلاق التسجيل في هذا النشاط.",
            };
          }

          if (
            error.message ===
            "ACTIVITY_NOT_AVAILABLE"
          ) {
            return {
              success: false,
              message:
                "هذا النشاط غير متاح للتسجيل حاليًا.",
            };
          }

          if (
            error.message ===
            "CAPACITY_FULL"
          ) {
            return {
              success: false,
              message:
                "عذرًا، اكتمل العدد في هذا النشاط.",
            };
          }
        }

        /*
         * Prisma Serializable transaction conflict.
         * نعيد المحاولة حتى 3 مرات.
         */
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

    revalidatePath(
      `/activities/${activityId}/register`,
    );

    revalidatePath(
      "/activities",
    );

    revalidatePath(
      "/admin/activities",
    );

    return {
      success: true,
      message:
        "تم تسجيلك في النشاط بنجاح ✅",
    };
  } catch (error) {
    /*
     * Validation messages
     */
    if (error instanceof Error) {
      const safeMessages = [
        "مطلوب.",
        "غير صالح",
        "صالحًا",
        "طويلة جدًا",
      ];

      if (
        safeMessages.some(
          (part) =>
            error.message.includes(
              part,
            ),
        )
      ) {
        return {
          success: false,
          message:
            error.message,
        };
      }
    }

    console.error(
      "Activity registration error:",
      error,
    );

    return {
      success: false,
      message:
        "حدث خطأ أثناء حفظ التسجيل. حاول مرة أخرى.",
    };
  }
}