import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

import { Prisma, type Role } from "@prisma/client";

import {
  PASSWORD_RESET_CODE_LENGTH,
  PASSWORD_RESET_CODE_TTL_MINUTES,
  PASSWORD_RESET_MAX_ATTEMPTS,
  PASSWORD_RESET_MAX_SENDS_PER_HOUR,
  PASSWORD_RESET_RESEND_SECONDS,
} from "@/lib/password-reset-constants";
import { prisma } from "@/lib/prisma";

const SEND_WINDOW_MS = 60 * 60 * 1000;
const sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret || sessionSecret.length < 32) {
  throw new Error(
    "SESSION_SECRET must contain at least 32 characters.",
  );
}

const resetSecret = `${sessionSecret}:password-reset-code`;

type ResetCodeData = {
  code: string;
  codeHash: string;
  expiresAt: Date;
};

export type IssuePasswordResetCodeResult =
  | ({ status: "ISSUED"; userId: string; email: string; name: string } & ResetCodeData)
  | { status: "COOLDOWN"; retryAfterSeconds: number }
  | { status: "RATE_LIMITED"; retryAfterSeconds: number }
  | { status: "INELIGIBLE" };

export type ResetPasswordResult =
  | { status: "RESET"; role: Role }
  | { status: "INVALID_CODE" | "EXPIRED" | "TOO_MANY_ATTEMPTS" | "CODE_NOT_FOUND" | "INELIGIBLE" };

async function runSerializableTransaction<T>(
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      const canRetry =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034" &&
        attempt < 2;

      if (!canRetry) throw error;
    }
  }

  throw new Error("Unable to complete serializable transaction.");
}

function generateCode() {
  return randomInt(0, 10 ** PASSWORD_RESET_CODE_LENGTH)
    .toString()
    .padStart(PASSWORD_RESET_CODE_LENGTH, "0");
}

function hashCode(userId: string, code: string) {
  return createHmac("sha256", resetSecret)
    .update(`password-reset\u001f${userId}\u001f${code}`)
    .digest("hex");
}

function createCodeData(
  userId: string,
  now: Date,
  previousHash?: string,
): ResetCodeData {
  let code: string;
  let codeHash: string;

  do {
    code = generateCode();
    codeHash = hashCode(userId, code);
  } while (previousHash && codeHash === previousHash);

  return {
    code,
    codeHash,
    expiresAt: new Date(
      now.getTime() + PASSWORD_RESET_CODE_TTL_MINUTES * 60 * 1000,
    ),
  };
}

function hashesMatch(expectedHash: string, actualHash: string) {
  const expected = Buffer.from(expectedHash, "hex");
  const actual = Buffer.from(actualHash, "hex");

  return (
    expected.length > 0 &&
    expected.length === actual.length &&
    timingSafeEqual(expected, actual)
  );
}

export async function issuePasswordResetCode(
  normalizedEmail: string,
): Promise<IssuePasswordResetCodeResult> {
  return runSerializableTransaction(async (transaction) => {
    const user = await transaction.user.findFirst({
      where: {
        email: { equals: normalizedEmail, mode: "insensitive" },
        role: { in: ["STUDENT", "MEMBER"] },
      },
      select: { id: true, email: true, name: true },
    });

    if (!user) return { status: "INELIGIBLE" };

    const now = new Date();
    const existing = await transaction.passwordResetCode.findUnique({
      where: { userId: user.id },
    });

    if (existing) {
      const elapsedSeconds = Math.floor(
        (now.getTime() - existing.lastSentAt.getTime()) / 1000,
      );

      if (elapsedSeconds < PASSWORD_RESET_RESEND_SECONDS) {
        return {
          status: "COOLDOWN",
          retryAfterSeconds:
            PASSWORD_RESET_RESEND_SECONDS - Math.max(0, elapsedSeconds),
        };
      }

      const withinWindow =
        existing.windowStartedAt.getTime() + SEND_WINDOW_MS > now.getTime();

      if (
        withinWindow &&
        existing.sendCount >= PASSWORD_RESET_MAX_SENDS_PER_HOUR
      ) {
        return {
          status: "RATE_LIMITED",
          retryAfterSeconds: Math.max(
            1,
            Math.ceil(
              (existing.windowStartedAt.getTime() + SEND_WINDOW_MS -
                now.getTime()) /
                1000,
            ),
          ),
        };
      }

      const reset = createCodeData(user.id, now, existing.codeHash);
      await transaction.passwordResetCode.update({
        where: { userId: user.id },
        data: {
          codeHash: reset.codeHash,
          expiresAt: reset.expiresAt,
          attempts: 0,
          lastSentAt: now,
          windowStartedAt: withinWindow ? existing.windowStartedAt : now,
          sendCount: withinWindow ? existing.sendCount + 1 : 1,
        },
      });

      return {
        status: "ISSUED",
        userId: user.id,
        email: user.email,
        name: user.name,
        ...reset,
      };
    }

    const reset = createCodeData(user.id, now);
    await transaction.passwordResetCode.create({
      data: {
        userId: user.id,
        codeHash: reset.codeHash,
        expiresAt: reset.expiresAt,
        attempts: 0,
        lastSentAt: now,
        windowStartedAt: now,
        sendCount: 1,
      },
    });

    return {
      status: "ISSUED",
      userId: user.id,
      email: user.email,
      name: user.name,
      ...reset,
    };
  });
}

export async function invalidateUndeliveredPasswordResetCode(
  userId: string,
  codeHash: string,
) {
  await prisma.passwordResetCode.deleteMany({
    where: { userId, codeHash },
  });
}

export async function resetPasswordWithCode({
  normalizedEmail,
  code,
  passwordHash,
}: {
  normalizedEmail: string;
  code: string;
  passwordHash: string;
}): Promise<ResetPasswordResult> {
  return runSerializableTransaction(async (transaction) => {
    const user = await transaction.user.findFirst({
      where: {
        email: { equals: normalizedEmail, mode: "insensitive" },
        role: { in: ["STUDENT", "MEMBER"] },
      },
      select: { id: true, role: true },
    });

    if (!user) return { status: "INELIGIBLE" };

    const record = await transaction.passwordResetCode.findUnique({
      where: { userId: user.id },
    });

    if (!record) return { status: "CODE_NOT_FOUND" };
    if (record.attempts >= PASSWORD_RESET_MAX_ATTEMPTS) {
      return { status: "TOO_MANY_ATTEMPTS" };
    }
    if (record.expiresAt.getTime() <= Date.now()) {
      return { status: "EXPIRED" };
    }

    const submittedHash = hashCode(user.id, code);
    if (!hashesMatch(record.codeHash, submittedHash)) {
      const attempts = record.attempts + 1;
      await transaction.passwordResetCode.update({
        where: { id: record.id },
        data: { attempts },
      });

      return attempts >= PASSWORD_RESET_MAX_ATTEMPTS
        ? { status: "TOO_MANY_ATTEMPTS" }
        : { status: "INVALID_CODE" };
    }

    await transaction.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangePassword: false,
        sessionVersion: { increment: 1 },
      },
    });

    await transaction.passwordResetCode.delete({
      where: { id: record.id },
    });

    return { status: "RESET", role: user.role };
  });
}
