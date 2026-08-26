import {
  createHmac,
  randomInt,
  timingSafeEqual,
} from "node:crypto";

import { Prisma } from "@prisma/client";

import {
  EMAIL_VERIFICATION_CODE_LENGTH,
  EMAIL_VERIFICATION_CODE_TTL_MINUTES,
  EMAIL_VERIFICATION_MAX_ATTEMPTS,
  EMAIL_VERIFICATION_MAX_SENDS_PER_HOUR,
  EMAIL_VERIFICATION_RESEND_SECONDS,
} from "./email-verification-constants.ts";
import { prisma } from "./prisma.ts";

export {
  EMAIL_VERIFICATION_CODE_LENGTH,
  EMAIL_VERIFICATION_CODE_TTL_MINUTES,
  EMAIL_VERIFICATION_MAX_ATTEMPTS,
  EMAIL_VERIFICATION_MAX_SENDS_PER_HOUR,
  EMAIL_VERIFICATION_RESEND_SECONDS,
} from "./email-verification-constants.ts";

const EMAIL_VERIFICATION_SEND_WINDOW_MS =
  60 * 60 * 1000;

const configuredVerificationSecret =
  process.env.EMAIL_VERIFICATION_SECRET?.trim();
const sessionSecret = process.env.SESSION_SECRET;

if (
  configuredVerificationSecret &&
  configuredVerificationSecret.length < 32
) {
  throw new Error(
    "EMAIL_VERIFICATION_SECRET must contain at least 32 characters.",
  );
}

if (
  !configuredVerificationSecret &&
  (!sessionSecret || sessionSecret.length < 32)
) {
  throw new Error(
    "EMAIL_VERIFICATION_SECRET or SESSION_SECRET must contain at least 32 characters.",
  );
}

const verificationSecret =
  configuredVerificationSecret ??
  `${sessionSecret}:email-verification-code`;

type VerificationCodeData = {
  code: string;
  codeHash: string;
  expiresAt: Date;
};

export type IssueVerificationCodeResult =
  | ({ status: "ISSUED" } & VerificationCodeData)
  | {
      status: "COOLDOWN";
      retryAfterSeconds: number;
    }
  | {
      status: "RATE_LIMITED";
      retryAfterSeconds: number;
    }
  | { status: "ALREADY_VERIFIED" }
  | { status: "USER_NOT_FOUND" };

export type VerifyEmailCodeResult =
  | {
      status: "VERIFIED" | "ALREADY_VERIFIED";
      role: "STUDENT" | "MEMBER" | "ADMIN";
    }
  | { status: "INVALID_CODE" }
  | { status: "EXPIRED" }
  | { status: "TOO_MANY_ATTEMPTS" }
  | { status: "CODE_NOT_FOUND" }
  | { status: "USER_NOT_FOUND" };

function generateVerificationCode() {
  return randomInt(
    0,
    10 ** EMAIL_VERIFICATION_CODE_LENGTH,
  )
    .toString()
    .padStart(
      EMAIL_VERIFICATION_CODE_LENGTH,
      "0",
    );
}

function hashVerificationCode(
  userId: string,
  code: string,
) {
  return createHmac(
    "sha256",
    verificationSecret,
  )
    .update(`${userId}:${code}`)
    .digest("hex");
}

function createVerificationCodeData(
  userId: string,
  now = new Date(),
  previousCodeHash?: string,
): VerificationCodeData {
  let code: string;
  let codeHash: string;

  do {
    code = generateVerificationCode();
    codeHash = hashVerificationCode(
      userId,
      code,
    );
  } while (
    previousCodeHash &&
    codeHash === previousCodeHash
  );

  return {
    code,
    codeHash,
    expiresAt: new Date(
      now.getTime() +
        EMAIL_VERIFICATION_CODE_TTL_MINUTES *
          60 *
          1000,
    ),
  };
}

function codeHashesMatch(
  expectedHash: string,
  actualHash: string,
) {
  const expected = Buffer.from(
    expectedHash,
    "hex",
  );
  const actual = Buffer.from(
    actualHash,
    "hex",
  );

  return (
    expected.length === actual.length &&
    expected.length > 0 &&
    timingSafeEqual(expected, actual)
  );
}

async function runSerializableTransaction<T>(
  operation: (
    transaction: Prisma.TransactionClient,
  ) => Promise<T>,
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel:
          Prisma.TransactionIsolationLevel
            .Serializable,
      });
    } catch (error) {
      const canRetry =
        error instanceof
          Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034" &&
        attempt < 2;

      if (!canRetry) throw error;
    }
  }

  throw new Error(
    "Unable to complete serializable transaction.",
  );
}

export async function createInitialEmailVerificationCode(
  transaction: Prisma.TransactionClient,
  userId: string,
) {
  const now = new Date();
  const verification =
    createVerificationCodeData(userId, now);

  await transaction.emailVerificationCode.create({
    data: {
      userId,
      codeHash: verification.codeHash,
      expiresAt: verification.expiresAt,
      attempts: 0,
      lastSentAt: now,
      windowStartedAt: now,
      sendCount: 1,
    },
  });

  return verification;
}

export async function hasUsableEmailVerificationCode(
  userId: string,
) {
  const code =
    await prisma.emailVerificationCode.findUnique({
      where: { userId },
      select: {
        expiresAt: true,
        attempts: true,
      },
    });

  return Boolean(
    code &&
      code.expiresAt.getTime() > Date.now() &&
      code.attempts <
        EMAIL_VERIFICATION_MAX_ATTEMPTS,
  );
}

export async function issueEmailVerificationCode(
  userId: string,
): Promise<IssueVerificationCodeResult> {
  return runSerializableTransaction(
    async (transaction) => {
      const user = await transaction.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          emailVerifiedAt: true,
        },
      });

      if (!user) {
        return { status: "USER_NOT_FOUND" };
      }

      if (user.emailVerifiedAt) {
        return { status: "ALREADY_VERIFIED" };
      }

      const now = new Date();
      const existing =
        await transaction.emailVerificationCode.findUnique(
          {
            where: { userId },
          },
        );

      if (existing) {
        const elapsedSeconds = Math.floor(
          (now.getTime() -
            existing.lastSentAt.getTime()) /
            1000,
        );

        if (
          elapsedSeconds <
          EMAIL_VERIFICATION_RESEND_SECONDS
        ) {
          return {
            status: "COOLDOWN",
            retryAfterSeconds:
              EMAIL_VERIFICATION_RESEND_SECONDS -
              Math.max(elapsedSeconds, 0),
          };
        }

        const windowEndsAt =
          existing.windowStartedAt.getTime() +
          EMAIL_VERIFICATION_SEND_WINDOW_MS;

        if (
          windowEndsAt > now.getTime() &&
          existing.sendCount >=
            EMAIL_VERIFICATION_MAX_SENDS_PER_HOUR
        ) {
          return {
            status: "RATE_LIMITED",
            retryAfterSeconds: Math.max(
              1,
              Math.ceil(
                (windowEndsAt - now.getTime()) /
                  1000,
              ),
            ),
          };
        }
      }

      const verification =
        createVerificationCodeData(
          userId,
          now,
          existing?.codeHash,
        );
      const continuesWindow = Boolean(
        existing &&
          existing.windowStartedAt.getTime() +
            EMAIL_VERIFICATION_SEND_WINDOW_MS >
            now.getTime(),
      );

      await transaction.emailVerificationCode.upsert({
        where: { userId },
        create: {
          userId,
          codeHash: verification.codeHash,
          expiresAt: verification.expiresAt,
          attempts: 0,
          lastSentAt: now,
          windowStartedAt: now,
          sendCount: 1,
        },
        update: {
          codeHash: verification.codeHash,
          expiresAt: verification.expiresAt,
          attempts: 0,
          lastSentAt: now,
          windowStartedAt: continuesWindow
            ? existing!.windowStartedAt
            : now,
          sendCount: continuesWindow
            ? existing!.sendCount + 1
            : 1,
        },
      });

      return {
        status: "ISSUED",
        ...verification,
      };
    },
  );
}

export async function invalidateUndeliveredVerificationCode(
  userId: string,
  codeHash: string,
) {
  await prisma.emailVerificationCode.updateMany({
    where: {
      userId,
      codeHash,
    },
    data: {
      expiresAt: new Date(0),
      attempts:
        EMAIL_VERIFICATION_MAX_ATTEMPTS,
    },
  });
}

export async function verifyEmailCode(
  userId: string,
  code: string,
): Promise<VerifyEmailCodeResult> {
  return runSerializableTransaction(
    async (transaction) => {
      const user = await transaction.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          role: true,
          emailVerifiedAt: true,
        },
      });

      if (!user) {
        return { status: "USER_NOT_FOUND" };
      }

      if (user.emailVerifiedAt) {
        await transaction.emailVerificationCode.deleteMany(
          { where: { userId } },
        );

        return {
          status: "ALREADY_VERIFIED",
          role: user.role,
        };
      }

      const verification =
        await transaction.emailVerificationCode.findUnique(
          { where: { userId } },
        );

      if (!verification) {
        return { status: "CODE_NOT_FOUND" };
      }

      if (
        verification.attempts >=
        EMAIL_VERIFICATION_MAX_ATTEMPTS
      ) {
        return {
          status: "TOO_MANY_ATTEMPTS",
        };
      }

      if (
        verification.expiresAt.getTime() <=
        Date.now()
      ) {
        return { status: "EXPIRED" };
      }

      const submittedHash = hashVerificationCode(
        userId,
        code,
      );

      if (
        !codeHashesMatch(
          verification.codeHash,
          submittedHash,
        )
      ) {
        const attempts =
          verification.attempts + 1;

        await transaction.emailVerificationCode.update({
          where: { id: verification.id },
          data: { attempts },
        });

        return attempts >=
          EMAIL_VERIFICATION_MAX_ATTEMPTS
          ? { status: "TOO_MANY_ATTEMPTS" }
          : { status: "INVALID_CODE" };
      }

      await transaction.user.update({
        where: { id: userId },
        data: {
          emailVerifiedAt: new Date(),
        },
      });

      await transaction.emailVerificationCode.deleteMany({
        where: { userId },
      });

      return {
        status: "VERIFIED",
        role: user.role,
      };
    },
  );
}

export async function getEmailVerificationContext(
  userId: string,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      emailVerifiedAt: true,
      emailVerificationCode: {
        select: {
          lastSentAt: true,
        },
      },
    },
  });

  if (!user) return null;

  const elapsedSeconds =
    user.emailVerificationCode
      ? Math.floor(
          (Date.now() -
            user.emailVerificationCode.lastSentAt.getTime()) /
            1000,
        )
      : EMAIL_VERIFICATION_RESEND_SECONDS;

  return {
    ...user,
    resendAfterSeconds: Math.max(
      0,
      EMAIL_VERIFICATION_RESEND_SECONDS -
        Math.max(elapsedSeconds, 0),
    ),
  };
}

export function maskEmail(email: string) {
  const [localPart, domain] = email.split("@");

  if (!localPart || !domain) return email;

  const visibleStart = localPart.slice(
    0,
    Math.min(2, localPart.length),
  );

  return `${visibleStart}${"*".repeat(
    Math.max(3, localPart.length - visibleStart.length),
  )}@${domain}`;
}
