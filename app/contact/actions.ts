"use server";

import {
  ComplaintType,
  CooperationType,
  EntityType,
  ExperienceLevel,
  PreferredActivityType,
  StudyLevel,
} from "@prisma/client";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { getSession } from "@/lib/auth";
import {
  createInitialRoutingRecords,
  findInitialContactAssignee,
} from "@/lib/contact-routing";
import { prisma } from "@/lib/prisma";
import { putPrivateBlob, tryDeletePrivateBlobs } from "@/lib/blob-storage";
import {
  UploadValidationError,
  logUploadRejection,
  validateCollaborationDocument,
} from "@/lib/upload-security";
import {
  UploadRateLimitError,
  clientIpFromHeaders,
  enforceCollaborationUploadLimit,
  uploadRateLimitMessage,
} from "@/lib/upload-rate-limit";

import { randomUUID } from "crypto";

/* =========================================================
   TYPES
========================================================= */

export type ContactFormState = {
  success: boolean;
  message: string;
};

/* =========================================================
   HELPERS
========================================================= */

function errorState(message: string): ContactFormState {
  return {
    success: false,
    message,
  };
}

function getString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value: string): boolean {
  return /^\+?[0-9\s\-()]{7,20}$/.test(value);
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return (
      url.protocol === "http:" ||
      url.protocol === "https:"
    );
  } catch {
    return false;
  }
}

function isStudyLevel(value: string): value is StudyLevel {
  return Object.values(StudyLevel).includes(
    value as StudyLevel
  );
}

function isComplaintType(
  value: string
): value is ComplaintType {
  return Object.values(ComplaintType).includes(
    value as ComplaintType
  );
}

function isPreferredActivityType(
  value: string
): value is PreferredActivityType {
  return Object.values(PreferredActivityType).includes(
    value as PreferredActivityType
  );
}

function isExperienceLevel(
  value: string
): value is ExperienceLevel {
  return Object.values(ExperienceLevel).includes(
    value as ExperienceLevel
  );
}

function isEntityType(
  value: string
): value is EntityType {
  return Object.values(EntityType).includes(
    value as EntityType
  );
}

function isCooperationType(
  value: string
): value is CooperationType {
  return Object.values(CooperationType).includes(
    value as CooperationType
  );
}

async function getSubmitterId() {
  const session = await getSession();

  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { id: true },
  });

  return user?.id ?? null;
}

const receivedMessage =
  "سيقوم فريقنا بمراجعة طلبك، وسنرد عليك في أقرب فرصة.";

/* =========================================================
   COMPLAINT
========================================================= */

export async function submitComplaint(
  _previousState: ContactFormState,
  formData: FormData
): Promise<ContactFormState> {
  try {
    /*
      Honeypot ضد البوتات.
      المستخدم الطبيعي لن يرى هذا الحقل.
    */
    if (getString(formData, "website")) {
      return {
        success: true,
        message: "تم استلام الطلب.",
      };
    }

    const studentName =
      getString(formData, "studentName") || null;

    const contact =
      getString(formData, "contact") || null;

    const departmentId =
      getString(formData, "departmentId");

    const studyLevel =
      getString(formData, "studyLevel");

    const type =
      getString(formData, "type");

    const details =
      getString(formData, "details");

    const wantsReply =
      getString(formData, "wantsReply");

    const submitterId =
      await getSubmitterId();

    /* ========================
       VALIDATION
    ======================== */

    if (!departmentId) {
      return errorState(
        "يرجى اختيار تخصص الطالب."
      );
    }

    if (!isStudyLevel(studyLevel)) {
      return errorState(
        "يرجى اختيار مستوى دراسي صحيح."
      );
    }

    if (!isComplaintType(type)) {
      return errorState(
        "يرجى اختيار نوع الملاحظة."
      );
    }

    if (details.length < 10) {
      return errorState(
        "يرجى كتابة تفاصيل أوضح للشكوى أو الملاحظة."
      );
    }

    if (
      wantsReply !== "yes" &&
      wantsReply !== "no"
    ) {
      return errorState(
        "يرجى تحديد ما إذا كنت ترغب بالحصول على رد."
      );
    }

    if (
      wantsReply === "yes" &&
      !submitterId
    ) {
      return errorState(
        "للحصول على رد داخل الموقع، سجّل الدخول إلى حسابك أولًا ثم أرسل الشكوى."
      );
    }

    const department =
      await prisma.department.findUnique({
        where: {
          id: departmentId,
        },
        select: {
          id: true,
          nameAr: true,
        },
      });

    if (!department) {
      return errorState(
        "التخصص المختار غير موجود."
      );
    }

    const assignment =
      await findInitialContactAssignee(
        department.id,
      );

    /* ========================
       SAVE
    ======================== */

    await prisma.$transaction(
      async (transaction) => {
        const request =
          await transaction.complaint.create({
          data: {
            studentName,
            contact,
            departmentId,
            studyLevel,
            type,
            details,
            wantsReply:
              wantsReply === "yes",
            submittedById: submitterId,
            assignedToId:
              assignment?.userId ?? null,
            assignedStructureItemId:
              assignment?.structureItemId ?? null,
            assignedAt: assignment
              ? new Date()
              : null,
          },
          select: { id: true },
        });

        if (submitterId) {
          await transaction.notification.create({
            data: {
              userId: submitterId,
              type: "SYSTEM",
              title: "تم استلام شكواك",
              body:
                "طلبك الآن بانتظار المراجعة، وسنرسل لك إشعارًا عند تحديث حالته.",
              href:
                "/contact#my-contact-requests",
            },
          });
        }

        await createInitialRoutingRecords(
          transaction,
          assignment,
          "COMPLAINT",
          request.id,
          `شكوى أو ملاحظة جديدة مرتبطة بقسم ${department.nameAr}.`,
        );
      }
    );

    revalidatePath("/contact");

    return {
      success: true,
      message: receivedMessage,
    };
  } catch (error) {
    console.error(
      "submitComplaint error:",
      error
    );

    return errorState(
      "حدث خطأ أثناء إرسال الملاحظة. يرجى المحاولة مرة أخرى."
    );
  }
}

/* =========================================================
   SUGGESTION
========================================================= */

export async function submitSuggestion(
  _previousState: ContactFormState,
  formData: FormData
): Promise<ContactFormState> {
  try {
    if (getString(formData, "website")) {
      return {
        success: true,
        message: "تم استلام الطلب.",
      };
    }

    const studentName =
      getString(formData, "studentName");

    const whatsapp =
      getString(formData, "whatsapp");

    const departmentId =
      getString(formData, "departmentId");

    const studyLevel =
      getString(formData, "studyLevel");

    const topics =
      getString(formData, "topics") || null;

    const activityType =
      getString(formData, "activityType");

    const activityLevel =
      getString(formData, "activityLevel");

    const projectIdea =
      getString(formData, "projectIdea");

    const experienceLevel =
      getString(formData, "experienceLevel");

    const submitterId =
      await getSubmitterId();

    /* ========================
       VALIDATION
    ======================== */

    if (studentName.length < 3) {
      return errorState(
        "يرجى إدخال اسم الطالب الثلاثي."
      );
    }

    if (!isValidPhone(whatsapp)) {
      return errorState(
        "يرجى إدخال رقم واتساب صحيح مع المقدمة."
      );
    }

    if (!departmentId) {
      return errorState(
        "يرجى اختيار تخصص الطالب."
      );
    }

    if (!isStudyLevel(studyLevel)) {
      return errorState(
        "يرجى اختيار المستوى الدراسي."
      );
    }

    if (
      !isPreferredActivityType(
        activityType
      )
    ) {
      return errorState(
        "يرجى اختيار نوع النشاط."
      );
    }

    if (
      !isExperienceLevel(
        activityLevel
      )
    ) {
      return errorState(
        "يرجى اختيار المستوى المناسب للنشاط."
      );
    }

    if (projectIdea.length < 3) {
      return errorState(
        "يرجى كتابة فكرة الفعالية أو المشروع."
      );
    }

    if (
      !isExperienceLevel(
        experienceLevel
      )
    ) {
      return errorState(
        "يرجى تحديد مستوى خبرتك في المجال المقترح."
      );
    }

    const department =
      await prisma.department.findUnique({
        where: {
          id: departmentId,
        },
        select: {
          id: true,
          nameAr: true,
        },
      });

    if (!department) {
      return errorState(
        "التخصص المختار غير موجود."
      );
    }

    const assignment =
      await findInitialContactAssignee(
        department.id,
      );

    /* ========================
       SAVE
    ======================== */

    await prisma.$transaction(
      async (transaction) => {
        const request =
          await transaction.suggestion.create({
          data: {
            studentName,
            whatsapp,
            departmentId,
            studyLevel,
            topics,
            activityType,
            activityLevel,
            projectIdea,
            experienceLevel,
            submittedById: submitterId,
            assignedToId:
              assignment?.userId ?? null,
            assignedStructureItemId:
              assignment?.structureItemId ?? null,
            assignedAt: assignment
              ? new Date()
              : null,
          },
          select: { id: true },
        });

        if (submitterId) {
          await transaction.notification.create({
            data: {
              userId: submitterId,
              type: "SYSTEM",
              title: "تم استلام اقتراحك",
              body:
                "اقتراحك الآن بانتظار المراجعة، وسنرسل لك إشعارًا عند تحديث حالته.",
              href:
                "/contact#my-contact-requests",
            },
          });
        }

        await createInitialRoutingRecords(
          transaction,
          assignment,
          "SUGGESTION",
          request.id,
          `اقتراح جديد مرتبط بقسم ${department.nameAr}.`,
        );
      }
    );

    revalidatePath("/contact");

    return {
      success: true,
      message: receivedMessage,
    };
  } catch (error) {
    console.error(
      "submitSuggestion error:",
      error
    );

    return errorState(
      "حدث خطأ أثناء إرسال الاقتراح. يرجى المحاولة مرة أخرى."
    );
  }
}

/* =========================================================
   COLLABORATION
========================================================= */

export async function submitCollaboration(
  _previousState: ContactFormState,
  formData: FormData
): Promise<ContactFormState> {
  let uploadedAttachmentPathname: string | null = null;

  try {
    if (getString(formData, "website")) {
      return {
        success: true,
        message: "تم استلام الطلب.",
      };
    }

    const entityName =
      getString(formData, "entityName");

    const entityType =
      getString(formData, "entityType");

    const contactPerson =
      getString(formData, "contactPerson");

    const phone =
      getString(formData, "phone");

    const email =
      getString(formData, "email");

    const socialUrl =
      getString(formData, "socialUrl");

    const cooperationType =
      getString(formData, "cooperationType");

    const description =
      getString(formData, "description");

    const field =
      getString(formData, "field");

    const additionalNotes =
      getString(
        formData,
        "additionalNotes"
      ) || null;

    const submitterId =
      await getSubmitterId();

    /* ========================
       VALIDATION
    ======================== */

    if (entityName.length < 2) {
      return errorState(
        "يرجى إدخال اسم الشخص أو المؤسسة أو الجهة."
      );
    }

    if (!isEntityType(entityType)) {
      return errorState(
        "يرجى اختيار نوع الجهة."
      );
    }

    if (contactPerson.length < 2) {
      return errorState(
        "يرجى إدخال اسم المسؤول عن التواصل."
      );
    }

    if (!isValidPhone(phone)) {
      return errorState(
        "يرجى إدخال رقم هاتف صحيح."
      );
    }

    if (!isValidEmail(email)) {
      return errorState(
        "يرجى إدخال بريد إلكتروني صحيح."
      );
    }

    if (!isValidUrl(socialUrl)) {
      return errorState(
        "يرجى إدخال رابط صحيح يبدأ بـ http:// أو https://"
      );
    }

    if (
      !isCooperationType(
        cooperationType
      )
    ) {
      return errorState(
        "يرجى اختيار نوع التعاون المقترح."
      );
    }

    if (description.length < 10) {
      return errorState(
        "يرجى كتابة وصف أوضح لفكرة التعاون."
      );
    }

    if (field.length < 2) {
      return errorState(
        "يرجى إدخال مجال التعاون."
      );
    }

    /* ========================
       OPTIONAL FILE
    ======================== */

    let attachmentStoredName:
      | string
      | null = null;

    let attachmentOriginalName:
      | string
      | null = null;

    let attachmentMime:
      | string
      | null = null;

    let attachmentSize:
      | number
      | null = null;

    const attachment =
      formData.get("attachment");

    if (
      attachment instanceof File &&
      attachment.size > 0
    ) {
      const MAX_FILE_SIZE =
        5 * 1024 * 1024;

      try {
        const requestHeaders = await headers();
        await enforceCollaborationUploadLimit(
          clientIpFromHeaders(requestHeaders),
          attachment.size,
        );

        const validated = await validateCollaborationDocument(
          attachment,
          MAX_FILE_SIZE,
        );
        const pathname = `collaboration/${randomUUID()}${validated.extension}`;
        const blob = await putPrivateBlob(pathname, validated.buffer, validated.mime);

        uploadedAttachmentPathname = blob.pathname;
        attachmentStoredName = blob.pathname;
        attachmentOriginalName = validated.originalName;
        attachmentMime = validated.mime;
        attachmentSize = validated.size;
      } catch (error) {
        logUploadRejection("collaboration", error, {
          size: attachment.size,
          mime: attachment.type,
        });

        if (error instanceof UploadRateLimitError) {
          return errorState(uploadRateLimitMessage(error));
        }

        if (error instanceof UploadValidationError) {
          return errorState(error.message);
        }

        throw error;
      }
    }

    /* ========================
       SAVE
    ======================== */

    const assignment =
      await findInitialContactAssignee(null);

    await prisma.$transaction(
      async (transaction) => {
        const request =
          await transaction.collaborationRequest.create({
          data: {
            entityName,
            entityType,
            contactPerson,
            phone,
            email,
            socialUrl,
            cooperationType,
            description,
            field,
            attachmentStoredName,
            attachmentOriginalName,
            attachmentMime,
            attachmentSize,
            additionalNotes,
            submittedById: submitterId,
            assignedToId:
              assignment?.userId ?? null,
            assignedStructureItemId:
              assignment?.structureItemId ?? null,
            assignedAt: assignment
              ? new Date()
              : null,
          },
          select: { id: true },
        });

        if (submitterId) {
          await transaction.notification.create({
            data: {
              userId: submitterId,
              type: "SYSTEM",
              title:
                "تم استلام طلب التعاون",
              body:
                "طلب التعاون الآن بانتظار المراجعة، وسنرسل لك إشعارًا عند تحديث حالته.",
              href:
                "/contact#my-contact-requests",
            },
          });
        }

        await createInitialRoutingRecords(
          transaction,
          assignment,
          "COLLABORATION",
          request.id,
          `طلب تعاون جديد من ${entityName}.`,
        );
      }
    );

    revalidatePath("/contact");

    return {
      success: true,
      message: receivedMessage,
    };
  } catch (error) {
    if (uploadedAttachmentPathname) {
      await tryDeletePrivateBlobs(
        [uploadedAttachmentPathname],
        "collaboration-db-failure",
      );
    }

    console.error(
      "submitCollaboration error:",
      error
    );

    return errorState(
      "حدث خطأ أثناء إرسال طلب التعاون. يرجى المحاولة مرة أخرى."
    );
  }
}
