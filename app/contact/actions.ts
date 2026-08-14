"use server";

import {
  ComplaintType,
  CooperationType,
  EntityType,
  ExperienceLevel,
  PreferredActivityType,
  StudyLevel,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

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
      return errorState(
        "التخصص المختار غير موجود."
      );
    }

    /* ========================
       SAVE
    ======================== */

    await prisma.complaint.create({
      data: {
        studentName,
        contact,

        departmentId,

        studyLevel,
        type,

        details,

        wantsReply:
          wantsReply === "yes",
      },
    });

    return {
      success: true,
      message:
        "تم إرسال الشكوى أو الملاحظة بنجاح. شكرًا لتواصلك معنا.",
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
        },
      });

    if (!department) {
      return errorState(
        "التخصص المختار غير موجود."
      );
    }

    /* ========================
       SAVE
    ======================== */

    await prisma.suggestion.create({
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
      },
    });

    return {
      success: true,
      message:
        "تم إرسال اقتراحك بنجاح. شكرًا لمساهمتك في تطوير أنشطة النادي.",
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

      if (
        attachment.size >
        MAX_FILE_SIZE
      ) {
        return errorState(
          "حجم الملف يجب ألا يتجاوز 5MB."
        );
      }

      const extension =
        path
          .extname(attachment.name)
          .toLowerCase();

      const allowedMimeTypes: Record<
        string,
        string[]
      > = {
        ".pdf": [
          "application/pdf",
        ],

        ".doc": [
          "application/msword",
        ],

        ".docx": [
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
      };

      const allowedMimes =
        allowedMimeTypes[extension];

      if (
        !allowedMimes ||
        !allowedMimes.includes(
          attachment.type
        )
      ) {
        return errorState(
          "يسمح فقط برفع ملفات PDF أو DOC أو DOCX."
        );
      }

      /*
        نخزن الملفات خارج public
        حتى لا تصبح متاحة مباشرة لأي شخص.
      */

      const storageDirectory =
        path.join(
          process.cwd(),
          "storage",
          "collaboration"
        );

      await mkdir(
        storageDirectory,
        {
          recursive: true,
        }
      );

      attachmentStoredName =
        `${randomUUID()}${extension}`;

      attachmentOriginalName =
        path.basename(
          attachment.name
        );

      attachmentMime =
        attachment.type;

      attachmentSize =
        attachment.size;

      const buffer =
        Buffer.from(
          await attachment.arrayBuffer()
        );

      await writeFile(
        path.join(
          storageDirectory,
          attachmentStoredName
        ),
        buffer
      );
    }

    /* ========================
       SAVE
    ======================== */

    await prisma.collaborationRequest.create({
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
      },
    });

    return {
      success: true,
      message:
        "تم إرسال طلب التعاون بنجاح. سيتواصل معكم النادي بعد مراجعته.",
    };
  } catch (error) {
    console.error(
      "submitCollaboration error:",
      error
    );

    return errorState(
      "حدث خطأ أثناء إرسال طلب التعاون. يرجى المحاولة مرة أخرى."
    );
  }
}