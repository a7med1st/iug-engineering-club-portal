import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = String(body.name || "").trim();
    const emailResult = validateEmail(
      String(body.email || ""),
    );
    const password = String(body.password || "");
    const departmentId =
      String(body.departmentId || "").trim() || null;

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
