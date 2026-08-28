import { createHmac } from "node:crypto";

import { prisma } from "@/lib/prisma";

const configuredRateLimitSecret = process.env.SESSION_SECRET;

if (
  !configuredRateLimitSecret ||
  configuredRateLimitSecret.length < 32
) {
  throw new Error(
    "SESSION_SECRET must be configured with at least 32 characters.",
  );
}

const rateLimitSecret: string = configuredRateLimitSecret;

export type RateLimitRule = {
  key: string;
  limit: number;
  windowSeconds: number;
  cost?: number;
};

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
};

function firstForwardedValue(value: string | null) {
  return value?.split(",", 1)[0]?.trim() || null;
}

export function getClientIp(request: Request) {
  return (
    firstForwardedValue(
      request.headers.get("x-forwarded-for"),
    ) ??
    request.headers.get("x-real-ip")?.trim() ??
    "unknown"
  );
}

export function createRateLimitKey(
  scope: string,
  ...parts: Array<string | null | undefined>
) {
  const normalized = parts
    .map((part) => String(part ?? "").trim().toLowerCase())
    .join("\u001f");

  return createHmac("sha256", rateLimitSecret)
    .update(`engineering-club-rate-limit\u001f${scope}\u001f${normalized}`)
    .digest("hex");
}

function retryAfterSeconds(resetAt: Date) {
  return Math.max(
    1,
    Math.ceil((resetAt.getTime() - Date.now()) / 1000),
  );
}

export async function checkRateLimits(
  rules: readonly RateLimitRule[],
): Promise<RateLimitResult> {
  const now = new Date();
  const counters = await prisma.rateLimitCounter.findMany({
    where: {
      key: { in: rules.map((rule) => rule.key) },
      resetAt: { gt: now },
    },
    select: { key: true, count: true, resetAt: true },
  });

  let retryAfter = 0;
  let remaining = Number.POSITIVE_INFINITY;

  for (const rule of rules) {
    const counter = counters.find((item) => item.key === rule.key);
    const count = counter?.count ?? 0;
    remaining = Math.min(remaining, Math.max(0, rule.limit - count));

    if (counter && count >= rule.limit) {
      retryAfter = Math.max(
        retryAfter,
        retryAfterSeconds(counter.resetAt),
      );
    }
  }

  return {
    allowed: retryAfter === 0,
    retryAfterSeconds: retryAfter,
    remaining: Number.isFinite(remaining) ? remaining : 0,
  };
}

async function consumeRateLimit(
  rule: RateLimitRule,
): Promise<RateLimitResult> {
  const resetAt = new Date(Date.now() + rule.windowSeconds * 1000);
  const cost = Math.max(1, Math.floor(rule.cost ?? 1));
  const rows = await prisma.$queryRaw<
    Array<{ count: number; resetAt: Date }>
  >`
    INSERT INTO "RateLimitCounter" ("key", "count", "resetAt", "updatedAt")
    VALUES (${rule.key}, ${cost}, ${resetAt}, CURRENT_TIMESTAMP)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimitCounter"."resetAt" <= CURRENT_TIMESTAMP THEN ${cost}
        ELSE "RateLimitCounter"."count" + ${cost}
      END,
      "resetAt" = CASE
        WHEN "RateLimitCounter"."resetAt" <= CURRENT_TIMESTAMP THEN ${resetAt}
        ELSE "RateLimitCounter"."resetAt"
      END,
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "count", "resetAt"
  `;

  const counter = rows[0];
  const count = counter?.count ?? rule.limit;

  return {
    allowed: count <= rule.limit,
    retryAfterSeconds:
      count <= rule.limit || !counter
        ? 0
        : retryAfterSeconds(counter.resetAt),
    remaining: Math.max(0, rule.limit - count),
  };
}

export async function consumeRateLimits(
  rules: readonly RateLimitRule[],
): Promise<RateLimitResult> {
  const results = await Promise.all(rules.map(consumeRateLimit));
  const blocked = results.filter((result) => !result.allowed);

  // Keep the distributed table bounded without adding a cleanup request to
  // every authentication attempt. The indexed deletion is awaited so it also
  // completes reliably in a serverless invocation.
  if (Math.random() < 0.01) {
    await prisma.rateLimitCounter.deleteMany({
      where: {
        resetAt: {
          lt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    });
  }

  return {
    allowed: blocked.length === 0,
    retryAfterSeconds: Math.max(
      0,
      ...blocked.map((result) => result.retryAfterSeconds),
    ),
    remaining: Math.min(...results.map((result) => result.remaining)),
  };
}

export async function resetRateLimits(
  rules: readonly RateLimitRule[],
) {
  await prisma.rateLimitCounter.deleteMany({
    where: { key: { in: rules.map((rule) => rule.key) } },
  });
}
