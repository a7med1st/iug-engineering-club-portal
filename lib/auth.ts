import type { Role } from "@prisma/client";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

const COOKIE = "ec_session";
const SESSION_ISSUER = "iug-engineering-club-portal";
const SESSION_AUDIENCE = "iug-engineering-club-web";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret || sessionSecret.length < 32) {
  throw new Error(
    "SESSION_SECRET must be configured with at least 32 characters.",
  );
}

const secret = new TextEncoder().encode(sessionSecret);
const validRoles = new Set<Role>(["STUDENT", "MEMBER", "ADMIN"]);

export type SessionPayload = {
  sub: string;
  email: string;
  name: string;
  role: Role;
  sessionVersion: number;
};

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  position: string | null;
  departmentId: string | null;
  managedDepartmentIds: string[];
  memberPermissions: string[];
  sessionVersion: number;
  mustChangePassword: boolean;
  department: {
    id: string;
    nameAr: string;
    nameEn: string;
  } | null;
};

function isSessionPayload(value: unknown): value is SessionPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Record<string, unknown>;

  return (
    typeof payload.sub === "string" &&
    payload.sub.length > 0 &&
    typeof payload.email === "string" &&
    payload.email.length > 0 &&
    typeof payload.name === "string" &&
    payload.name.length > 0 &&
    typeof payload.role === "string" &&
    validRoles.has(payload.role as Role) &&
    typeof payload.sessionVersion === "number" &&
    Number.isSafeInteger(payload.sessionVersion) &&
    payload.sessionVersion >= 0
  );
}

async function readSessionToken(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
      issuer: SESSION_ISSUER,
      audience: SESSION_AUDIENCE,
    });

    return isSessionPayload(payload) ? payload : null;
  } catch {
    return null;
  }
}

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT({
    email: payload.email,
    name: payload.name,
    role: payload.role,
    sessionVersion: payload.sessionVersion,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuer(SESSION_ISSUER)
    .setAudience(SESSION_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secret);

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.set(COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getCurrentUser(): Promise<{
  session: SessionPayload;
  user: CurrentUser;
} | null> {
  const session = await readSessionToken();

  if (!session) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      position: true,
      departmentId: true,
      managedDepartmentIds: true,
      memberPermissions: true,
      sessionVersion: true,
      mustChangePassword: true,
      department: {
        select: {
          id: true,
          nameAr: true,
          nameEn: true,
        },
      },
    },
  });

  if (!user || user.sessionVersion !== session.sessionVersion) {
    return null;
  }

  return { session, user };
}

export async function getSession(): Promise<SessionPayload | null> {
  return (await getCurrentUser())?.session ?? null;
}

export async function invalidateAllUserSessions(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } },
  });
}

export async function requireAdmin() {
  const auth = await getCurrentUser();

  if (!auth || auth.user.role !== "ADMIN") {
    redirect("/login?portal=member");
  }

  if (auth.user.mustChangePassword) redirect("/change-password");

  return auth.session;
}

export async function requireMember() {
  const auth = await getCurrentUser();

  if (
    !auth ||
    (auth.user.role !== "MEMBER" && auth.user.role !== "ADMIN")
  ) {
    redirect("/login?portal=member");
  }

  if (auth.user.mustChangePassword) redirect("/change-password");

  return auth.session;
}

export async function requireStudent() {
  const auth = await getCurrentUser();

  if (!auth || auth.user.role !== "STUDENT") {
    redirect("/login?portal=student");
  }

  if (auth.user.mustChangePassword) redirect("/change-password");

  return {
    session: auth.session,
    user: {
      id: auth.user.id,
      role: auth.user.role,
      name: auth.user.name,
      email: auth.user.email,
      department: auth.user.department
        ? { nameAr: auth.user.department.nameAr }
        : null,
    },
  };
}
