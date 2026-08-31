import { NextResponse } from "next/server";

import {
  createRateLimitKey,
  getClientIp,
  type RateLimitRule,
} from "@/lib/rate-limit";

export function loginRateLimitRules(
  request: Request,
  email: string,
): RateLimitRule[] {
  const ip = getClientIp(request);

  return [
    {
      key: createRateLimitKey("login:ip-email", ip, email),
      limit: 7,
      windowSeconds: 15 * 60,
    },
    {
      key: createRateLimitKey("login:ip", ip),
      limit: 40,
      windowSeconds: 15 * 60,
    },
  ];
}

export function registrationRateLimitRules(
  request: Request,
): RateLimitRule[] {
  return [
    {
      key: createRateLimitKey(
        "register:ip",
        getClientIp(request),
      ),
      limit: 10,
      windowSeconds: 60 * 60,
    },
  ];
}

export function verifyEmailRateLimitRules(
  request: Request,
  userId: string,
): RateLimitRule[] {
  const ip = getClientIp(request);

  return [
    {
      key: createRateLimitKey("verify-email:ip-user", ip, userId),
      limit: 12,
      windowSeconds: 15 * 60,
    },
    {
      key: createRateLimitKey("verify-email:ip", ip),
      limit: 40,
      windowSeconds: 15 * 60,
    },
  ];
}

export function resendVerificationRateLimitRules(
  request: Request,
  userId: string,
): RateLimitRule[] {
  const ip = getClientIp(request);

  return [
    {
      key: createRateLimitKey("resend-email:ip-user", ip, userId),
      limit: 8,
      windowSeconds: 60 * 60,
    },
    {
      key: createRateLimitKey("resend-email:ip", ip),
      limit: 30,
      windowSeconds: 60 * 60,
    },
  ];
}

export function forgotPasswordRateLimitRules(
  request: Request,
  email: string,
): RateLimitRule[] {
  const ip = getClientIp(request);
  return [
    {
      key: createRateLimitKey("forgot-password:ip-email", ip, email),
      limit: 5,
      windowSeconds: 60 * 60,
    },
    {
      key: createRateLimitKey("forgot-password:ip", ip),
      limit: 25,
      windowSeconds: 60 * 60,
    },
  ];
}

export function resendPasswordResetRateLimitRules(
  request: Request,
  email: string,
): RateLimitRule[] {
  const ip = getClientIp(request);
  return [
    {
      key: createRateLimitKey("resend-password-reset:ip-email", ip, email),
      limit: 8,
      windowSeconds: 60 * 60,
    },
    {
      key: createRateLimitKey("resend-password-reset:ip", ip),
      limit: 30,
      windowSeconds: 60 * 60,
    },
  ];
}

export function resetPasswordRateLimitRules(
  request: Request,
  email: string,
): RateLimitRule[] {
  const ip = getClientIp(request);
  return [
    {
      key: createRateLimitKey("reset-password:ip-email", ip, email),
      limit: 12,
      windowSeconds: 15 * 60,
    },
    {
      key: createRateLimitKey("reset-password:ip", ip),
      limit: 40,
      windowSeconds: 15 * 60,
    },
  ];
}

export function changePasswordRateLimitRules(
  request: Request,
  userId: string,
): RateLimitRule[] {
  return [
    {
      key: createRateLimitKey(
        "change-password:ip-user",
        getClientIp(request),
        userId,
      ),
      limit: 8,
      windowSeconds: 15 * 60,
    },
  ];
}

export function rateLimitResponse(retryAfterSeconds: number) {
  const retryAfter = Math.max(1, Math.ceil(retryAfterSeconds));

  return NextResponse.json(
    {
      error: "تم تجاوز الحد المؤقت للمحاولات. حاول مرة أخرى لاحقًا.",
      retryAfterSeconds: retryAfter,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "Cache-Control": "no-store",
      },
    },
  );
}
