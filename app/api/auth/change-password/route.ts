import {
  changePasswordRateLimitRules,
  rateLimitResponse,
} from "@/lib/auth-rate-limit";
import { createSession, getCurrentUser } from "@/lib/auth";
import {
  hashPassword,
  validateNewPassword,
  verifyPassword,
} from "@/lib/password";
import { privateNoStoreJson } from "@/lib/private-response";
import { prisma } from "@/lib/prisma";
import { consumeRateLimits, resetRateLimits } from "@/lib/rate-limit";
import { rejectCrossOriginRequest } from "@/lib/request-security";

export async function POST(request: Request) {
  const crossOriginResponse = rejectCrossOriginRequest(request);
  if (crossOriginResponse) return crossOriginResponse;

  try {
    const auth = await getCurrentUser();
    if (!auth) {
      return privateNoStoreJson({ ok: false }, { status: 401 });
    }
    if (!auth.user.mustChangePassword) {
      return privateNoStoreJson(
        { ok: false, error: "PASSWORD_CHANGE_NOT_REQUIRED" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const currentPassword = String(body.currentPassword ?? "");
    const password = String(body.password ?? "");
    const confirmation = String(body.confirmPassword ?? "");
    const passwordError = validateNewPassword(password, confirmation);
    if (currentPassword.length < 1 || currentPassword.length > 128) {
      return privateNoStoreJson(
        { ok: false, error: "كلمة المرور الحالية غير صحيحة." },
        { status: 400 },
      );
    }
    if (passwordError) {
      return privateNoStoreJson(
        { ok: false, error: passwordError },
        { status: 400 },
      );
    }

    const rules = changePasswordRateLimitRules(request, auth.user.id);
    const rateLimit = await consumeRateLimits(rules);
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.retryAfterSeconds);
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.user.id },
      select: { passwordHash: true },
    });
    if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
      return privateNoStoreJson(
        { ok: false, error: "كلمة المرور الحالية غير صحيحة." },
        { status: 400 },
      );
    }
    if (await verifyPassword(password, user.passwordHash)) {
      return privateNoStoreJson(
        { ok: false, error: "يجب أن تختلف كلمة المرور الجديدة عن الحالية." },
        { status: 400 },
      );
    }

    const passwordHash = await hashPassword(password);
    const updated = await prisma.$transaction(async (transaction) =>
      transaction.user.update({
        where: {
          id: auth.user.id,
          sessionVersion: auth.user.sessionVersion,
          mustChangePassword: true,
        },
        data: {
          passwordHash,
          mustChangePassword: false,
          sessionVersion: { increment: 1 },
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          sessionVersion: true,
        },
      }),
    );

    await resetRateLimits(rules);
    await createSession({
      sub: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      sessionVersion: updated.sessionVersion,
    });

    return privateNoStoreJson({
      ok: true,
      redirect:
        updated.role === "ADMIN"
          ? "/admin"
          : updated.role === "MEMBER"
            ? "/member"
            : "/student",
    });
  } catch {
    return privateNoStoreJson(
      { ok: false, error: "تعذر تغيير كلمة المرور الآن." },
      { status: 500 },
    );
  }
}
