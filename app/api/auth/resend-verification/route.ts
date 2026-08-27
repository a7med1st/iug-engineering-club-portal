import { NextResponse } from "next/server";

import {
  rateLimitResponse,
  resendVerificationRateLimitRules,
} from "@/lib/auth-rate-limit";
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
import { consumeRateLimits } from "@/lib/rate-limit";
import { rejectCrossOriginRequest } from "@/lib/request-security";

export async function POST(request: Request) {
  const crossOriginResponse = rejectCrossOriginRequest(request);

  if (crossOriginResponse) {
    return crossOriginResponse;
  }

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

  const networkRateLimit = await consumeRateLimits(
    resendVerificationRateLimitRules(request, session.sub),
  );

  if (!networkRateLimit.allowed) {
    return rateLimitResponse(networkRateLimit.retryAfterSeconds);
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
      {
        status: 429,
        headers: {
          "Retry-After": String(issued.retryAfterSeconds),
          "Cache-Control": "no-store",
        },
      },
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
      {
        status: 429,
        headers: {
          "Retry-After": String(issued.retryAfterSeconds),
          "Cache-Control": "no-store",
        },
      },
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
    if (process.env.NODE_ENV === "development") {
      return NextResponse.json({
        ok: true,
        message:
          "تعذر تسليم البريد، ويمكنك استخدام رمز التطوير المحلي الظاهر في الصفحة.",
        developmentVerificationCode:
          issued.code,
        retryAfterSeconds:
          EMAIL_VERIFICATION_RESEND_SECONDS,
      });
    }

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
    developmentVerificationCode:
      process.env.NODE_ENV === "development"
        ? issued.code
        : undefined,
    retryAfterSeconds:
      EMAIL_VERIFICATION_RESEND_SECONDS,
  });
}
