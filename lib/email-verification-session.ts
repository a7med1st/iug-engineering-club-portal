import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const VERIFICATION_COOKIE =
  "ec_email_verification";
const VERIFICATION_SESSION_MAX_AGE_SECONDS =
  60 * 60;
const VERIFICATION_ISSUER =
  "iug-engineering-club-portal";
const VERIFICATION_AUDIENCE =
  "email-verification";

const sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret || sessionSecret.length < 32) {
  throw new Error(
    "SESSION_SECRET must be configured with at least 32 characters.",
  );
}

const verificationSecret =
  new TextEncoder().encode(
    `${sessionSecret}:email-verification-session`,
  );

type VerificationSessionPayload = {
  sub: string;
  purpose: "email-verification";
};

export async function createEmailVerificationSession(
  userId: string,
) {
  const token = await new SignJWT({
    purpose: "email-verification",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer(VERIFICATION_ISSUER)
    .setAudience(VERIFICATION_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(
      `${VERIFICATION_SESSION_MAX_AGE_SECONDS}s`,
    )
    .sign(verificationSecret);

  const store = await cookies();

  store.set(VERIFICATION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure:
      process.env.NODE_ENV === "production",
    path: "/",
    maxAge:
      VERIFICATION_SESSION_MAX_AGE_SECONDS,
  });
}

export async function getEmailVerificationSession(): Promise<VerificationSessionPayload | null> {
  const store = await cookies();
  const token = store.get(
    VERIFICATION_COOKIE,
  )?.value;

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(
      token,
      verificationSecret,
      {
        algorithms: ["HS256"],
        issuer: VERIFICATION_ISSUER,
        audience: VERIFICATION_AUDIENCE,
      },
    );

    if (
      typeof payload.sub !== "string" ||
      payload.purpose !==
        "email-verification"
    ) {
      return null;
    }

    return {
      sub: payload.sub,
      purpose: "email-verification",
    };
  } catch {
    return null;
  }
}

export async function clearEmailVerificationSession() {
  const store = await cookies();

  store.set(VERIFICATION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure:
      process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
