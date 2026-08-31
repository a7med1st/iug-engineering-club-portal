import bcrypt from "bcryptjs";
import { createSession } from "@/lib/auth";
import {
  loginRateLimitRules,
  rateLimitResponse,
} from "@/lib/auth-rate-limit";
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
import { privateNoStoreJson } from "@/lib/private-response";
import {
  checkRateLimits,
  consumeRateLimits,
  resetRateLimits,
} from "@/lib/rate-limit";
import { rejectCrossOriginRequest } from "@/lib/request-security";

export async function POST(req: Request) {
  const crossOriginResponse = rejectCrossOriginRequest(req);

  if (crossOriginResponse) {
    return crossOriginResponse;
  }

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
    const rateLimitRules = loginRateLimitRules(req, email);
    const rateLimitStatus = await checkRateLimits(rateLimitRules);

    if (!rateLimitStatus.allowed) {
      return rateLimitResponse(rateLimitStatus.retryAfterSeconds);
    }

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
      const failedAttempt = await consumeRateLimits(rateLimitRules);

      if (!failedAttempt.allowed) {
        return rateLimitResponse(failedAttempt.retryAfterSeconds);
      }

      return privateNoStoreJson(
        {
          error:
            "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
        },
        { status: 401 },
      );
    }

    await resetRateLimits(rateLimitRules);

    if (
      portal === "student" &&
      user.role !== "STUDENT"
    ) {
      return privateNoStoreJson(
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
      return privateNoStoreJson(
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

      return privateNoStoreJson(
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
      sessionVersion: user.sessionVersion,
    });

    return privateNoStoreJson({
      ok: true,
      redirect:
        user.mustChangePassword
          ? "/change-password"
          : user.role === "ADMIN"
          ? "/admin"
          : user.role === "MEMBER"
            ? "/member"
            : "/",
    });
  } catch {
    return privateNoStoreJson(
      {
        error:
          "حدث خطأ غير متوقع.",
      },
      { status: 500 },
    );
  }
}
