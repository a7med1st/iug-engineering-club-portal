import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import {
  rateLimitResponse,
  registrationRateLimitRules,
} from "@/lib/auth-rate-limit";
import {
  getEmailValidationMessage,
  validateEmail,
} from "@/lib/email-validation";
import {
  createInitialEmailVerificationCode,
  invalidateUndeliveredVerificationCode,
} from "@/lib/email-verification";
import { createEmailVerificationSession } from "@/lib/email-verification-session";
import {
  assertEmailDeliveryConfigured,
  sendEmailVerificationCode,
} from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { consumeRateLimits } from "@/lib/rate-limit";
import { rejectCrossOriginRequest } from "@/lib/request-security";
import {
  optionalStudentRegistrationFields,
  StudentRegistrationFieldError,
} from "@/lib/student-registration";

export async function POST(req: Request) {
  const crossOriginResponse = rejectCrossOriginRequest(req);

  if (crossOriginResponse) {
    return crossOriginResponse;
  }

  try {
    const rateLimit = await consumeRateLimits(
      registrationRateLimitRules(req),
    );

    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.retryAfterSeconds);
    }

    const body = await req.json();
    const name = String(body.name || "").trim();
    const emailResult = validateEmail(
      String(body.email || ""),
    );
    const password = String(body.password || "");
    let optionalFields;
    try {
      optionalFields = optionalStudentRegistrationFields(body);
    } catch (error) {
      if (error instanceof StudentRegistrationFieldError) {
        return NextResponse.json({ error: error.message, field: error.field }, { status: 400 });
      }
      throw error;
    }
    const { departmentId, studentNumber } = optionalFields;

    if (name.length < 2) {
      return NextResponse.json(
        {
          error:
            "يرجى إدخال اسم صحيح يتكون من حرفين على الأقل.",
        },
        { status: 400 },
      );
    }

    if (!emailResult.valid) {
      return NextResponse.json(
        {
          error:
            getEmailValidationMessage(emailResult),
          field: "email",
          reason: emailResult.reason,
        },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        {
          error:
            "يجب ألا تقل كلمة المرور عن 8 أحرف.",
        },
        { status: 400 },
      );
    }

    const departmentExists = departmentId
      ? await prisma.department.findUnique({
        where: { id: departmentId },
        select: { id: true },
      })
      : null;

    if (departmentId && !departmentExists) {
      return NextResponse.json(
        {
          error: "التخصص المختار غير موجود.",
          field: "departmentId",
        },
        { status: 400 },
      );
    }

    try {
      assertEmailDeliveryConfigured();
    } catch {
      return NextResponse.json(
        {
          error:
            "خدمة إرسال البريد غير متاحة حاليًا. حاول لاحقًا.",
        },
        { status: 503 },
      );
    }

    const email = emailResult.email;

    const exists = await prisma.user.findFirst({
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

    if (exists) {
      return NextResponse.json(
        {
          error:
            "هذا البريد الإلكتروني مستخدم بالفعل.",
          field: "email",
        },
        { status: 409 },
      );
    }

    if (studentNumber) {
      const numberExists = await prisma.user.findUnique({
        where: { studentNumber },
        select: { id: true },
      });
      if (numberExists) {
        return NextResponse.json(
          { error: "هذا الرقم الجامعي مسجل مسبقًا.", field: "studentNumber" },
          { status: 409 },
        );
      }
    }

    const passwordHash = await bcrypt.hash(
      password,
      12,
    );

    const registration =
      await prisma.$transaction(
        async (transaction) => {
          const user =
            await transaction.user.create({
              data: {
                name,
                email,
                emailVerifiedAt: null,
                passwordHash,
                role: "STUDENT",
                departmentId,
                studentNumber,
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

    await createEmailVerificationSession(
      registration.user.id,
    );

    const developmentVerificationCode =
      process.env.NODE_ENV === "development"
        ? registration.verification.code
        : undefined;

    try {
      await sendEmailVerificationCode({
        email: registration.user.email,
        name: registration.user.name,
        code: registration.verification.code,
      });
    } catch {
      if (developmentVerificationCode) {
        return NextResponse.json(
          {
            ok: true,
            verificationRequired: true,
            deliveryFailed: true,
            developmentVerificationCode,
            redirect:
              "/verify-email?delivery=failed",
          },
          { status: 202 },
        );
      }

      await invalidateUndeliveredVerificationCode(
        registration.user.id,
        registration.verification.codeHash,
      );

      return NextResponse.json(
        {
          ok: true,
          verificationRequired: true,
          deliveryFailed: true,
          redirect:
            "/verify-email?delivery=failed",
        },
        { status: 202 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        verificationRequired: true,
        developmentVerificationCode,
        redirect: "/verify-email",
      },
      { status: 201 },
    );
  } catch (error) {
    if (
      error instanceof
        Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const target = Array.isArray(error.meta?.target) ? error.meta.target.map(String) : [];
      if (target.includes("studentNumber")) {
        return NextResponse.json(
          { error: "هذا الرقم الجامعي مسجل مسبقًا.", field: "studentNumber" },
          { status: 409 },
        );
      }
      return NextResponse.json(
        {
          error:
            "هذا البريد الإلكتروني مستخدم بالفعل.",
          field: "email",
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        error:
          "تعذر إنشاء حساب الطالب.",
      },
      { status: 500 },
    );
  }
}
