import {
  consumeRateLimits,
  createRateLimitKey,
  type RateLimitRule,
} from "@/lib/rate-limit";

const MB = 1024 * 1024;

export class UploadRateLimitError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super("تم تجاوز حد الرفع المؤقت. حاول مرة أخرى لاحقًا.");
  }
}

export function clientIpFromHeaders(headers: Headers) {
  return (
    headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

function requestRule(scope: string, identity: string, limit: number, windowSeconds: number): RateLimitRule {
  return {
    key: createRateLimitKey(`${scope}:requests`, identity),
    limit,
    windowSeconds,
  };
}

function byteRule(scope: string, identity: string, limitBytes: number, windowSeconds: number, bytes: number): RateLimitRule {
  return {
    key: createRateLimitKey(`${scope}:bytes`, identity),
    limit: limitBytes,
    windowSeconds,
    cost: Math.max(1, bytes),
  };
}

export async function enforceCollaborationUploadLimit(ip: string, bytes: number) {
  return enforce([
    requestRule("upload:collaboration", ip, 8, 60 * 60),
    byteRule("upload:collaboration", ip, 25 * MB, 60 * 60, bytes),
  ], "collaboration", { ip });
}

export async function enforceChatUploadLimit(userId: string, conversationId: string, bytes: number) {
  return enforce([
    requestRule("upload:chat:user", userId, 30, 15 * 60),
    requestRule("upload:chat:conversation", conversationId, 80, 60 * 60),
    byteRule("upload:chat:user", userId, 150 * MB, 60 * 60, bytes),
  ], "chat", { userId, conversationId });
}

export async function enforceActivityUploadLimit(userId: string, bytes: number) {
  return enforce([
    requestRule("upload:activity", userId, 20, 15 * 60),
    byteRule("upload:activity", userId, 100 * MB, 60 * 60, bytes),
  ], "activity", { userId });
}

export async function enforceProfileUploadLimit(userId: string, bytes: number) {
  return enforce([
    requestRule("upload:profile", userId, 12, 60 * 60),
    byteRule("upload:profile", userId, 60 * MB, 60 * 60, bytes),
  ], "profile", { userId });
}

async function enforce(
  rules: RateLimitRule[],
  context: string,
  logContext: Record<string, string>,
) {
  const result = await consumeRateLimits(rules);
  if (result.allowed) return result;

  console.warn("Upload rate limit exceeded", {
    context,
    ...logContext,
    retryAfterSeconds: result.retryAfterSeconds,
  });
  throw new UploadRateLimitError(result.retryAfterSeconds);
}

export function uploadRateLimitMessage(error: UploadRateLimitError) {
  const minutes = Math.max(1, Math.ceil(error.retryAfterSeconds / 60));
  return `تم تجاوز حد الرفع المؤقت. حاول مرة أخرى بعد ${minutes} دقيقة.`;
}
