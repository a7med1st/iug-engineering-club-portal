import {
  forgotPasswordRateLimitRules,
  rateLimitResponse,
} from "@/lib/auth-rate-limit";
import {
  getEmailValidationMessage,
  validateEmail,
} from "@/lib/email-validation";
import { deliverPasswordResetCode } from "@/lib/password-reset-request";
import { privateNoStoreJson } from "@/lib/private-response";
import { consumeRateLimits } from "@/lib/rate-limit";
import { rejectCrossOriginRequest } from "@/lib/request-security";

const GENERIC_MESSAGE =
  "إذا كان البريد مرتبطًا بحساب مؤهل، فسيصلك رمز استعادة خلال دقائق.";

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

    const rateLimit = await consumeRateLimits(
      forgotPasswordRateLimitRules(request, emailResult.email),
    );
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.retryAfterSeconds);
    }

    await deliverPasswordResetCode(emailResult.email);

    return privateNoStoreJson({
      ok: true,
      message: GENERIC_MESSAGE,
      redirect: `/reset-password?email=${encodeURIComponent(emailResult.email)}`,
      retryAfterSeconds: 60,
    });
  } catch {
    return privateNoStoreJson(
      { ok: false, error: "تعذر إكمال الطلب الآن. حاول مرة أخرى لاحقًا." },
      { status: 500 },
    );
  }
}
