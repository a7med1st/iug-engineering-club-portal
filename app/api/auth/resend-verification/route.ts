import { NextResponse } from "next/server";

import {
  clearEmailVerificationSession,
  getEmailVerificationSession,
} from "@/lib/email-verification-session";
import {
  invalidateUndeliveredVerificationCode,
  EMAIL_VERIFICATION_RESEND_SECONDS,
  getEmailVerificationContext,
  issueEmailVerificationCode,
} from "@/lib/email-verification";
import {
  assertEmailDeliveryConfigured,
  sendEmailVerificationCode,
} from "@/lib/mail";

export async function POST() {
  const session =
    await getEmailVerificationSession();

  if (!session) {
    return NextResponse.json(
      {
        error:
          "انتهت جلسة التحقق. سجّل الدخول مرة أخرى للمتابعة.",
        sessionExpired: true,
      },
      { status: 401 },
    );
  }

  const context =
    await getEmailVerificationContext(
      session.sub,
    );

  if (!context) {
    await clearEmailVerificationSession();

    return NextResponse.json(
      {
        error:
          "تعذر متابعة التحقق. سجّل الدخول مرة أخرى.",
        sessionExpired: true,
      },
      { status: 401 },
    );
  }

  if (context.emailVerifiedAt) {
    await clearEmailVerificationSession();

    return NextResponse.json({
      ok: true,
      alreadyVerified: true,
      redirect: "/login?verified=1",
    });
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

  const issued =
    await issueEmailVerificationCode(
      context.id,
    );

  if (issued.status === "COOLDOWN") {
    return NextResponse.json(
      {
        error: `يمكنك طلب رمز جديد بعد ${issued.retryAfterSeconds} ثانية.`,
        retryAfterSeconds:
          issued.retryAfterSeconds,
      },
      { status: 429 },
    );
  }

  if (issued.status === "RATE_LIMITED") {
    return NextResponse.json(
      {
        error:
          "تم بلوغ الحد المؤقت لإرسال الرموز. حاول لاحقًا.",
        retryAfterSeconds:
          issued.retryAfterSeconds,
      },
      { status: 429 },
    );
  }

  if (
    issued.status === "ALREADY_VERIFIED"
  ) {
    await clearEmailVerificationSession();

    return NextResponse.json({
      ok: true,
      alreadyVerified: true,
      redirect: "/login?verified=1",
    });
  }

  if (issued.status === "USER_NOT_FOUND") {
    await clearEmailVerificationSession();

    return NextResponse.json(
      {
        error:
          "تعذر متابعة التحقق. سجّل الدخول مرة أخرى.",
        sessionExpired: true,
      },
      { status: 401 },
    );
  }

  try {
    await sendEmailVerificationCode({
      email: context.email,
      name: context.name,
      code: issued.code,
    });
  } catch {
    await invalidateUndeliveredVerificationCode(
      context.id,
      issued.codeHash,
    );

    return NextResponse.json(
      {
        error:
          "تعذر إرسال رمز التحقق حاليًا. حاول مرة أخرى.",
        retryAfterSeconds:
          EMAIL_VERIFICATION_RESEND_SECONDS,
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    ok: true,
    message:
      "تم إرسال رمز تحقق جديد إلى بريدك الإلكتروني.",
    retryAfterSeconds:
      EMAIL_VERIFICATION_RESEND_SECONDS,
  });
}
