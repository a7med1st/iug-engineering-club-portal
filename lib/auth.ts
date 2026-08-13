import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const COOKIE = "ec_session";
const sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret || sessionSecret.length < 32) {
  throw new Error("SESSION_SECRET must be configured with at least 32 characters.");
}

const secret = new TextEncoder().encode(sessionSecret);

export type SessionPayload = { sub: string; email: string; name: string; role: Role };

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/login?portal=member");

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { role: true },
  });
  if (user?.role !== "ADMIN") redirect("/login?portal=member");

  return session;
}

export async function requireMember() {
  const session = await getSession();
  if (!session || (session.role !== "MEMBER" && session.role !== "ADMIN")) redirect("/login?portal=member");

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { role: true },
  });
  if (!user || (user.role !== "MEMBER" && user.role !== "ADMIN")) redirect("/login?portal=member");

  return session;
}
