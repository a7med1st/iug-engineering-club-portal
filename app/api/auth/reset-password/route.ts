import {
  rateLimitResponse,
  resetPasswordRateLimitRules,
} from "@/lib/auth-rate-limit";
import { clearSession } from "@/lib/auth";
import {
  getEmailValidationMessage,
  validateEmail,
} from "@/lib/email-validation";
import { hashPassword, validateNewPassword } from "@/lib/password";
import { resetPasswordWithCode } from "@/lib/password-reset";
import { PASSWORD_RESET_CODE_LENGTH } from "@/lib/password-reset-constants";
import { privateNoStoreJson } from "@/lib/private-response";
import { consumeRateLimits } from "@/lib/rate-limit";
import { rejectCrossOriginRequest } from "@/lib/request-security";

const INVALID_CODE_MESSAGE = "رمز التحقق غير صحيح أو انتهت صلاحيته.";

export async function POST(request: Request) {
  const crossOriginResponse = rejectCrossOriginRequest(request);
  if (crossOriginResponse) return crossOriginResponse;

  try {
    const body = await request.json();
    const emailResult = validateEmail(String(body.email ?? ""));
    if (!emailResult.valid) {
      return privateNoStoreJson(
        { ok: false, error: getEmailValidationMessage(emailResult) },
        { status: 400 },
      );
    }

    const code = String(body.code ?? "").trim();
    if (!new RegExp(`^\\d{${PASSWORD_RESET_CODE_LENGTH}}$`).test(code)) {
      return privateNoStoreJson(
        { ok: false, error: INVALID_CODE_MESSAGE },
        { status: 400 },
      );
    }

    const password = String(body.password ?? "");
    const confirmation = String(body.confirmPassword ?? "");
    const passwordError = validateNewPassword(password, confirmation);
    if (passwordError) {
      return privateNoStoreJson(
        { ok: false, error: passwordError },
        { status: 400 },
      );
    }

    const rateLimit = await consumeRateLimits(
      resetPasswordRateLimitRules(request, emailResult.email),
    );
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.retryAfterSeconds);
    }

    const passwordHash = await hashPassword(password);
    const result = await resetPasswordWithCode({
      normalizedEmail: emailResult.email,
      code,
      passwordHash,
    });

    if (result.status !== "RESET") {
      return privateNoStoreJson(
        { ok: false, error: INVALID_CODE_MESSAGE },
        { status: 400 },
      );
    }

    await clearSession();
    const portal = result.role === "STUDENT" ? "student" : "member";

    return privateNoStoreJson({
      ok: true,
      message: "تم تغيير كلمة المرور بنجاح. يمكنك تسجيل الدخول الآن.",
      redirect: `/login?portal=${portal}&passwordReset=success`,
    });
  } catch {
    return privateNoStoreJson(
      { ok: false, error: "تعذر تغيير كلمة المرور الآن." },
      { status: 500 },
    );
  }
}
