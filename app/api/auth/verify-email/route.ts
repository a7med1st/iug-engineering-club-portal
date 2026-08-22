import { NextResponse } from "next/server";

import {
  clearEmailVerificationSession,
  getEmailVerificationSession,
} from "@/lib/email-verification-session";
import {
  EMAIL_VERIFICATION_CODE_LENGTH,
  verifyEmailCode,
} from "@/lib/email-verification";

export async function POST(request: Request) {
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

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error:
          "يرجى إدخال رمز التحقق المكوّن من 6 أرقام.",
      },
      { status: 400 },
    );
  }

  const code = String(
    (body as { code?: unknown }).code ?? "",
  ).trim();

  if (
    !new RegExp(
      `^\\d{${EMAIL_VERIFICATION_CODE_LENGTH}}$`,
    ).test(code)
  ) {
    return NextResponse.json(
      {
        error:
          "يرجى إدخال رمز التحقق المكوّن من 6 أرقام.",
      },
      { status: 400 },
    );
  }

  const result = await verifyEmailCode(
    session.sub,
    code,
  );

  if (
    result.status === "VERIFIED" ||
    result.status === "ALREADY_VERIFIED"
  ) {
    await clearEmailVerificationSession();

    const portal =
      result.role === "STUDENT"
        ? "student"
        : "member";

    return NextResponse.json({
      ok: true,
      redirect: `/login?portal=${portal}&verified=1`,
    });
  }

  if (result.status === "EXPIRED") {
    return NextResponse.json(
      {
        error:
          "انتهت صلاحية رمز التحقق. اطلب رمزًا جديدًا.",
        codeExpired: true,
      },
      { status: 410 },
    );
  }

  if (
    result.status === "TOO_MANY_ATTEMPTS"
  ) {
    return NextResponse.json(
      {
        error:
          "تم تجاوز عدد المحاولات المسموح. اطلب رمز تحقق جديدًا.",
        attemptsExceeded: true,
      },
      { status: 429 },
    );
  }

  if (result.status === "INVALID_CODE") {
    return NextResponse.json(
      {
        error:
          "رمز التحقق غير صحيح.",
      },
      { status: 400 },
    );
  }

  return NextResponse.json(
    {
      error:
        "لا يوجد رمز تحقق فعال. اطلب رمزًا جديدًا.",
    },
    { status: 400 },
  );
}
