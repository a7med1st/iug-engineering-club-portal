import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { createSession } from "@/lib/auth";
import { normalizeEmail } from "@/lib/email-validation";
import {
  invalidateUndeliveredVerificationCode,
  hasUsableEmailVerificationCode,
  issueEmailVerificationCode,
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
    const email = normalizeEmail(
      String(body.email || ""),
    );
    const password = String(body.password || "");
    const portal =
      body.portal === "member"
        ? "member"
        : "student";

    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: email,
          mode: "insensitive",
        },
      },
    });

    if (
      !user ||
      !(await bcrypt.compare(
        password,
        user.passwordHash,
      ))
    ) {
      return NextResponse.json(
        {
          error:
            "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
        },
        { status: 401 },
      );
    }

    if (
      portal === "student" &&
      user.role !== "STUDENT"
    ) {
      return NextResponse.json(
        {
          error:
            "هذا الحساب ليس حساب طالب. استخدم بوابة الأعضاء.",
        },
        { status: 403 },
      );
    }

    if (
      portal === "member" &&
      user.role === "STUDENT"
    ) {
      return NextResponse.json(
        {
          error:
            "حساب الطالب لا يمكنه الدخول من بوابة الأعضاء.",
        },
        { status: 403 },
      );
    }

    if (!user.emailVerifiedAt) {
      await createEmailVerificationSession(user.id);

      let deliveryFailed = false;
      const hasUsableCode =
        await hasUsableEmailVerificationCode(
          user.id,
        );

      if (!hasUsableCode) {
        try {
          assertEmailDeliveryConfigured();

          const issued =
            await issueEmailVerificationCode(
              user.id,
            );

          if (issued.status === "ISSUED") {
            try {
              await sendEmailVerificationCode({
                email: user.email,
                name: user.name,
                code: issued.code,
              });
            } catch {
              await invalidateUndeliveredVerificationCode(
                user.id,
                issued.codeHash,
              );
              deliveryFailed = true;
            }
          } else if (
            issued.status === "COOLDOWN" ||
            issued.status === "RATE_LIMITED"
          ) {
            deliveryFailed = true;
          }
        } catch {
          deliveryFailed = true;
        }
      }

      return NextResponse.json(
        {
          verificationRequired: true,
          redirect: deliveryFailed
            ? "/verify-email?delivery=failed"
            : "/verify-email",
        },
        { status: 403 },
      );
    }

    await createSession({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    return NextResponse.json({
      ok: true,
      redirect:
        user.role === "ADMIN"
          ? "/admin"
          : user.role === "MEMBER"
            ? "/member"
            : "/",
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "حدث خطأ غير متوقع.",
      },
      { status: 500 },
    );
  }
}
