import {
  createInitialEmailVerificationCode,
  issueEmailVerificationCode,
  verifyEmailCode,
} from "../lib/email-verification";
import {
  normalizeEmail,
  validateEmail,
} from "../lib/email-validation";
import { prisma } from "../lib/prisma";

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new Error(message);
}

async function createTestUser(suffix: string) {
  const email = `email-verification-${Date.now()}-${suffix}@gmail.com`;

  return prisma.$transaction(
    async (transaction) => {
      const user = await transaction.user.create({
        data: {
          name: "Email Verification Test",
          email,
          emailVerifiedAt: null,
          passwordHash: "not-used-by-this-test",
          role: "STUDENT",
        },
        select: { id: true },
      });
      const verification =
        await createInitialEmailVerificationCode(
          transaction,
          user.id,
        );

      return { user, verification };
    },
  );
}

async function main() {
  assert(
    normalizeEmail(" USER@GMAIL.COM ") ===
      "user@gmail.com",
    "Uppercase email normalization failed.",
  );
  assert(
    validateEmail("user@gmail.com").valid,
    "Allowed email was rejected.",
  );

  for (const email of [
    "user@gail.com",
    "user@gmial.com",
    "user@gmail.co",
    "user@random.com",
    "user@fakegmail.com",
    "user@gmail.com.fake.com",
  ]) {
    assert(
      !validateEmail(email).valid,
      `Disallowed email was accepted: ${email}`,
    );
  }

  const createdUserIds: string[] = [];

  try {
    const locked = await createTestUser("locked");
    createdUserIds.push(locked.user.id);

    const stored =
      await prisma.emailVerificationCode.findUnique({
        where: { userId: locked.user.id },
        select: { codeHash: true },
      });

    assert(stored, "Verification hash was not stored.");
    assert(
      stored.codeHash !== locked.verification.code &&
        /^[a-f0-9]{64}$/.test(stored.codeHash),
      "The verification code was not stored as an HMAC hash.",
    );

    const wrongCode =
      locked.verification.code === "999999"
        ? "888888"
        : "999999";

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const result = await verifyEmailCode(
        locked.user.id,
        wrongCode,
      );
      assert(
        result.status === "INVALID_CODE",
        `Attempt ${attempt} should be rejected as invalid.`,
      );
    }

    const fifthAttempt = await verifyEmailCode(
      locked.user.id,
      wrongCode,
    );
    assert(
      fifthAttempt.status === "TOO_MANY_ATTEMPTS",
      "The fifth invalid attempt did not lock the code.",
    );

    await prisma.emailVerificationCode.update({
      where: { userId: locked.user.id },
      data: {
        lastSentAt: new Date(Date.now() - 61_000),
      },
    });

    const replacement =
      await issueEmailVerificationCode(
        locked.user.id,
      );
    assert(
      replacement.status === "ISSUED",
      "A replacement code was not issued after cooldown.",
    );

    const oldCodeResult = await verifyEmailCode(
      locked.user.id,
      locked.verification.code,
    );
    assert(
      oldCodeResult.status === "INVALID_CODE",
      "The old code remained usable after resend.",
    );

    const verifiedResult = await verifyEmailCode(
      locked.user.id,
      replacement.code,
    );
    assert(
      verifiedResult.status === "VERIFIED",
      "The replacement code did not verify the user.",
    );

    const verifiedUser = await prisma.user.findUnique({
      where: { id: locked.user.id },
      select: {
        emailVerifiedAt: true,
        emailVerificationCode: true,
      },
    });
    assert(
      verifiedUser?.emailVerifiedAt &&
        !verifiedUser.emailVerificationCode,
      "Verification did not activate the email and remove its code.",
    );

    const expired = await createTestUser("expired");
    createdUserIds.push(expired.user.id);
    await prisma.emailVerificationCode.update({
      where: { userId: expired.user.id },
      data: {
        expiresAt: new Date(Date.now() - 1_000),
      },
    });
    const expiredResult = await verifyEmailCode(
      expired.user.id,
      expired.verification.code,
    );
    assert(
      expiredResult.status === "EXPIRED",
      "An expired code was accepted.",
    );

    const cooldown = await createTestUser("cooldown");
    createdUserIds.push(cooldown.user.id);
    const cooldownResult =
      await issueEmailVerificationCode(
        cooldown.user.id,
      );
    assert(
      cooldownResult.status === "COOLDOWN" &&
        cooldownResult.retryAfterSeconds > 0,
      "Server-side resend cooldown was not enforced.",
    );

    console.log(
      "Email verification integration tests passed.",
    );
  } finally {
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
    }

    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : "Email verification tests failed.",
  );
  process.exitCode = 1;
});
