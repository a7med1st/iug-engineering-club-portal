"use server";

import {
  Prisma,
  type ActivityFormQuestionType,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  consumeRateLimits,
  createRateLimitKey,
} from "@/lib/rate-limit";
import { registrationWindowStatus } from "@/lib/registration-window";
import { clientIpFromHeaders } from "@/lib/upload-rate-limit";

export type RegistrationFormValues = Record<string, string>;

export type RegistrationFormState = {
  success: boolean;
  message: string;
  values: RegistrationFormValues;
  fieldErrors?: Record<string, string>;
};

const initialFailure: RegistrationFormState = {
  success: false,
  message: "",
  values: {},
};

const QUESTION_FIELD_PREFIX = "question_";
const IDENTITY_FIELDS = new Set([
  "studentName",
  "studentEmail",
  "studentDepartmentId",
]);

class RegistrationValidationError extends Error {
  constructor(
    message: string,
    readonly questionId: string,
  ) {
    super(message);
    this.name = "RegistrationValidationError";
  }
}

function getSubmittedValues(formData: FormData): RegistrationFormValues {
  const values: RegistrationFormValues = {};

  for (const [fieldName, rawValue] of formData.entries()) {
    if (
      (!fieldName.startsWith(QUESTION_FIELD_PREFIX) &&
        !IDENTITY_FIELDS.has(fieldName)) ||
      typeof rawValue !== "string"
    ) {
      continue;
    }

    const questionId = fieldName.startsWith(QUESTION_FIELD_PREFIX)
      ? fieldName.slice(QUESTION_FIELD_PREFIX.length)
      : fieldName;

    if (questionId && values[questionId] === undefined) {
      values[questionId] = rawValue;
    }
  }

  return values;
}

function failure(
  message: string,
  values: RegistrationFormValues,
  fieldErrors?: Record<string, string>,
): RegistrationFormState {
  return {
    success: false,
    message,
    values,
    ...(fieldErrors ? { fieldErrors } : {}),
  };
}

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
   * Every option-based question accepts exactly one value. Checking getAll()
   * also protects the invariant when a request is crafted outside the UI.
   */
  const submittedEntries = formData.getAll(fieldName);

  if (isOptionQuestion(question.type) && submittedEntries.length > 1) {
    throw new RegistrationValidationError(
      `السؤال "${question.label}" يسمح باختيار خيار واحد فقط.`,
      question.id,
    );
  }

  const submittedValue = submittedEntries[0];
  const value = typeof submittedValue === "string" ? submittedValue.trim() : "";

  if (
    question.required &&
    !value
  ) {
    throw new RegistrationValidationError(
      `السؤال "${question.label}" مطلوب.`,
      question.id,
    );
  }

  if (!value) {
    return null;
  }

  /*
   * SELECT / RADIO / legacy CHECKBOX
   */
  if (isOptionQuestion(question.type)) {
    const allowedOptions =
      getQuestionOptions(
        question.options,
      );

    if (
      !allowedOptions.includes(value)
    ) {
      throw new RegistrationValidationError(
        `تم إرسال خيار غير صالح في السؤال "${question.label}".`,
        question.id,
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
    throw new RegistrationValidationError(
      `أدخل بريدًا إلكترونيًا صالحًا في السؤال "${question.label}".`,
      question.id,
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
    throw new RegistrationValidationError(
      `أدخل رقمًا صالحًا في السؤال "${question.label}".`,
      question.id,
    );
  }

  /*
   * حماية من نصوص ضخمة بشكل غير منطقي.
   */
  if (value.length > 10_000) {
    throw new RegistrationValidationError(
      `الإجابة على السؤال "${question.label}" طويلة جدًا.`,
      question.id,
    );
  }

  return value;
}

export async function submitActivityRegistration(
  _previousState: RegistrationFormState =
    initialFailure,
  formData: FormData,
): Promise<RegistrationFormState> {
  const submittedValues = getSubmittedValues(formData);

  const activityId = String(
    formData.get("activityId") ??
      "",
  ).trim();

  const formId = String(
    formData.get("formId") ?? "",
  ).trim();

  if (!activityId || !formId) {
    return failure(
      "بيانات نموذج التسجيل غير مكتملة.",
      submittedValues,
    );
  }

  // Hidden from people, but commonly filled by automated spam bots.
  if (String(formData.get("website") ?? "").trim()) {
    return {
      success: true,
      message: "تم استلام التسجيل.",
      values: {},
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
      return failure(
        "نموذج التسجيل غير موجود أو لا يتبع لهذا النشاط.",
        submittedValues,
      );
    }

    if (
      form.activity.status !==
      "PUBLISHED"
    ) {
      return failure(
        "هذا النشاط غير متاح للتسجيل حاليًا.",
        submittedValues,
      );
    }

    const registrationStatus = registrationWindowStatus(form);

    if (registrationStatus !== "OPEN") {
      const message = registrationStatus === "NOT_STARTED"
        ? "لم يبدأ موعد التسجيل في هذا النشاط بعد."
        : registrationStatus === "ENDED"
          ? "انتهى موعد التسجيل في هذا النشاط."
          : "التسجيل في هذا النشاط مغلق.";

      return failure(
        message,
        submittedValues,
      );
    }

    type RegistrationStudent = {
      id: string;
      name: string;
      email: string;
      department: { nameAr: string } | null;
    };

    const currentAuth = await getCurrentUser();
    let studentUser: RegistrationStudent | null =
      currentAuth?.user.role === "STUDENT"
        ? currentAuth.user
        : null;

    if (form.requiresAccount && !studentUser) {
      return failure(
        "يجب تسجيل الدخول بحساب طالب لتعبئة هذا النموذج.",
        submittedValues,
      );
    }

    const submittedName = String(
      formData.get("studentName") ?? "",
    ).trim();
    const submittedEmail = String(
      formData.get("studentEmail") ?? "",
    ).trim().toLowerCase();
    const submittedDepartmentId = String(
      formData.get("studentDepartmentId") ?? "",
    ).trim();

    const studentName = studentUser?.name.trim() ?? submittedName;
    const studentEmail =
      studentUser?.email.trim().toLowerCase() ?? submittedEmail;
    let studentDepartment = studentUser?.department?.nameAr ?? null;

    if (!studentUser) {
      const identityErrors: Record<string, string> = {};

      if (studentName.length < 2 || studentName.length > 160) {
        identityErrors.studentName =
          "أدخل الاسم الكامل (من حرفين إلى 160 حرفًا).";
      }

      if (
        studentEmail.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(studentEmail)
      ) {
        identityErrors.studentEmail =
          "أدخل بريدًا إلكترونيًا صالحًا.";
      }

      if (submittedDepartmentId) {
        const department = await prisma.department.findUnique({
          where: { id: submittedDepartmentId },
          select: { nameAr: true },
        });

        if (!department) {
          identityErrors.studentDepartmentId =
            "اختر تخصصًا صحيحًا من القائمة.";
        } else {
          studentDepartment = department.nameAr;
        }
      }

      if (Object.keys(identityErrors).length > 0) {
        return failure(
          "تحقق من بيانات الطالب ثم أرسل التسجيل مرة أخرى.",
          submittedValues,
          identityErrors,
        );
      }

      const requestHeaders = await headers();
      const clientIp = clientIpFromHeaders(requestHeaders);
      const rateLimit = await consumeRateLimits([
        {
          key: createRateLimitKey(
            "activity-registration:ip-form",
            clientIp,
            form.id,
          ),
          limit: 30,
          windowSeconds: 15 * 60,
        },
        {
          key: createRateLimitKey(
            "activity-registration:email-form",
            studentEmail,
            form.id,
          ),
          limit: 5,
          windowSeconds: 60 * 60,
        },
      ]);

      if (!rateLimit.allowed) {
        return failure(
          "تم إرسال محاولات كثيرة. حاول مرة أخرى لاحقًا.",
          submittedValues,
        );
      }
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
                where: studentUser
                  ? {
                    formId: form.id,
                    OR: [
                      { userId: studentUser.id },
                      {
                        studentEmail: {
                          equals: studentEmail,
                          mode: "insensitive",
                        },
                      },
                    ],
                  }
                  : {
                    formId: form.id,
                    studentEmail: {
                      equals: studentEmail,
                      mode: "insensitive",
                    },
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
                  opensAt: true,
                  closesAt: true,
                  requiresAccount: true,

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
              registrationWindowStatus(latestForm) !== "OPEN"
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

            if (latestForm.requiresAccount && !studentUser) {
              throw new Error(
                "ACCOUNT_REQUIRED",
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
                  studentUser?.id ??
                  null,

                studentName:
                  studentName,

                studentEmail:
                  studentEmail,

                studentDepartment:
                  studentDepartment,

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
            return failure(
              "يوجد تسجيل سابق بهذا البريد الإلكتروني في هذا النشاط.",
              submittedValues,
            );
          }

          if (
            error.message ===
            "REGISTRATION_CLOSED"
          ) {
            return failure(
              "تم إغلاق التسجيل في هذا النشاط.",
              submittedValues,
            );
          }

          if (
            error.message ===
            "ACTIVITY_NOT_AVAILABLE"
          ) {
            return failure(
              "هذا النشاط غير متاح للتسجيل حاليًا.",
              submittedValues,
            );
          }

          if (
            error.message ===
            "ACCOUNT_REQUIRED"
          ) {
            return failure(
              "أصبح تسجيل الدخول مطلوبًا لهذا النموذج. سجّل دخولك ثم حاول مرة أخرى.",
              submittedValues,
            );
          }

          if (
            error.message ===
            "CAPACITY_FULL"
          ) {
            return failure(
              "عذرًا، اكتمل العدد في هذا النشاط.",
              submittedValues,
            );
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
      values: {},
    };
  } catch (error) {
    if (error instanceof RegistrationValidationError) {
      return failure(error.message, submittedValues, {
        [error.questionId]: error.message,
      });
    }

    console.error(
      "Activity registration error:",
      error,
    );

    return failure(
      "حدث خطأ أثناء حفظ التسجيل. حاول مرة أخرى.",
      submittedValues,
    );
  }
}
