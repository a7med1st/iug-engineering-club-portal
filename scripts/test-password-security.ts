import { randomInt } from "node:crypto";
import { readFile } from "node:fs/promises";

import bcrypt from "bcryptjs";
import { SignJWT } from "jose";

import {
  forgotPasswordRateLimitRules,
  resetPasswordRateLimitRules,
} from "../lib/auth-rate-limit.ts";
import { hashPassword } from "../lib/password.ts";
import {
  issuePasswordResetCode,
  resetPasswordWithCode,
} from "../lib/password-reset.ts";
import {
  PASSWORD_RESET_CODE_TTL_MINUTES,
  PASSWORD_RESET_MAX_ATTEMPTS,
} from "../lib/password-reset-constants.ts";
import { prisma } from "../lib/prisma.ts";

const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const origin = new URL(baseUrl).origin;
const secretValue = process.env.SESSION_SECRET;
if (!secretValue || secretValue.length < 32) {
  throw new Error("SESSION_SECRET is required for password security tests.");
}
const jwtSecret = new TextEncoder().encode(secretValue);
const prefix = `password-security-${Date.now()}-${randomInt(1000, 9999)}`;
const createdUserIds: string[] = [];
const rateLimitKeys = new Set<string>();
const results: Array<{ name: string; ok: boolean; detail: string }> = [];

function record(name: string, condition: unknown, detail: string) {
  const ok = Boolean(condition);
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} - ${detail}`);
}

function wrongCode(code: string) {
  return code === "999999" ? "888888" : "999999";
}

async function createUser(
  suffix: string,
  options: {
    role?: "STUDENT" | "MEMBER" | "ADMIN";
    verified?: boolean;
    forced?: boolean;
    password?: string;
  } = {},
) {
  const password = options.password ?? "Temporary-Pass-123";
  const user = await prisma.user.create({
    data: {
      name: `Password Test ${suffix}`,
      email: `${prefix}-${suffix}@gmail.com`,
      emailVerifiedAt: options.verified === false ? null : new Date(),
      passwordHash: await bcrypt.hash(password, 12),
      role: options.role ?? "STUDENT",
      ...(options.forced === undefined
        ? {}
        : { mustChangePassword: options.forced }),
    },
  });
  createdUserIds.push(user.id);
  return { ...user, plainPassword: password };
}

async function tokenFor(user: {
  id: string;
  email: string;
  name: string;
  role: "STUDENT" | "MEMBER" | "ADMIN";
  sessionVersion: number;
}) {
  return new SignJWT({
    email: user.email,
    name: user.name,
    role: user.role,
    sessionVersion: user.sessionVersion,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuer("iug-engineering-club-portal")
    .setAudience("iug-engineering-club-web")
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(jwtSecret);
}

async function request(
  path: string,
  options: {
    method?: string;
    token?: string;
    cookie?: string;
    body?: unknown;
    ip?: string;
    origin?: string | null;
  } = {},
) {
  const method = options.method ?? "GET";
  const headers = new Headers();
  if (options.body !== undefined) headers.set("content-type", "application/json");
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && options.origin !== null) {
    headers.set("origin", options.origin ?? origin);
  }
  if (options.ip) headers.set("x-forwarded-for", options.ip);
  if (options.cookie) headers.set("cookie", options.cookie);
  else if (options.token) headers.set("cookie", `ec_session=${options.token}`);

  return fetch(new URL(path, baseUrl), {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    redirect: "manual",
  });
}

async function json(response: Response) {
  return response.json().catch(() => ({})) as Promise<Record<string, unknown>>;
}

function trackRules(rules: Array<{ key: string }>) {
  for (const rule of rules) rateLimitKeys.add(rule.key);
}

async function main() {
  await prisma.user.deleteMany({
    where: { email: { startsWith: "password-security-" } },
  });

  const source = await readFile("app/admin/actions.ts", "utf8");
  const adminPage = await readFile("app/admin/members/page.tsx", "utf8");
  record(
    "Admin-created member requires password change",
    source.includes('role: "MEMBER"') && source.includes("mustChangePassword: true"),
    "createMember persists the forced-change flag",
  );
  record(
    "Temporary password admin copy",
    adminPage.includes("كلمة المرور المؤقتة") &&
      adminPage.includes("سيُطلب من العضو تغيير كلمة المرور بعد تسجيل الدخول لأول مرة."),
    "exact label and helper are present",
  );

  const defaultUser = await createUser("default", { role: "MEMBER" });
  record(
    "Existing/default accounts remain unaffected",
    defaultUser.mustChangePassword === false,
    `mustChangePassword=${defaultUser.mustChangePassword}`,
  );

  const forced = await createUser("forced", {
    role: "MEMBER",
    forced: true,
  });
  const forcedToken = await tokenFor(forced);
  const loginIp = `198.51.100.${randomInt(1, 240)}`;
  const forcedLogin = await request("/api/auth/login", {
    method: "POST",
    ip: loginIp,
    body: {
      email: forced.email,
      password: forced.plainPassword,
      portal: "member",
    },
  });
  const forcedLoginBody = await json(forcedLogin);
  record(
    "Forced member login redirects to change flow",
    forcedLogin.status === 200 && forcedLoginBody.redirect === "/change-password",
    `status=${forcedLogin.status} redirect=${String(forcedLoginBody.redirect)}`,
  );

  const protectedPage = await request("/member", { token: forcedToken });
  record(
    "Forced member cannot bypass protected pages",
    [303, 307, 308].includes(protectedPage.status) &&
      protectedPage.headers.get("location")?.includes("/change-password"),
    `status=${protectedPage.status} location=${protectedPage.headers.get("location")}`,
  );
  await protectedPage.arrayBuffer();

  const protectedApi = await request("/api/notifications", { token: forcedToken });
  const protectedApiBody = await json(protectedApi);
  record(
    "Forced member receives JSON denial from protected APIs",
    protectedApi.status === 403 &&
      protectedApiBody.error === "PASSWORD_CHANGE_REQUIRED" &&
      (protectedApi.headers.get("content-type") ?? "").includes("application/json"),
    `status=${protectedApi.status}`,
  );
  record(
    "Forced API denial is not cached",
    protectedApi.headers.get("cache-control") === "private, no-store",
    `cache-control=${protectedApi.headers.get("cache-control")}`,
  );

  const changePage = await request("/change-password", { token: forcedToken });
  record(
    "Forced change page remains accessible",
    changePage.status === 200,
    `status=${changePage.status}`,
  );
  await changePage.arrayBuffer();

  const changeRequest = async (body: Record<string, string>, token = forcedToken) =>
    request("/api/auth/change-password", {
      method: "POST",
      token,
      ip: `203.0.113.${randomInt(1, 240)}`,
      body,
    });

  const wrongCurrent = await changeRequest({
    currentPassword: "Wrong-Password-123",
    password: "New-Secure-Pass-456",
    confirmPassword: "New-Secure-Pass-456",
  });
  record("Wrong current password is rejected", wrongCurrent.status === 400, `status=${wrongCurrent.status}`);
  await wrongCurrent.arrayBuffer();

  const shortPassword = await changeRequest({
    currentPassword: forced.plainPassword,
    password: "short",
    confirmPassword: "short",
  });
  record("Short forced password is rejected", shortPassword.status === 400, `status=${shortPassword.status}`);
  await shortPassword.arrayBuffer();

  const mismatch = await changeRequest({
    currentPassword: forced.plainPassword,
    password: "New-Secure-Pass-456",
    confirmPassword: "Different-Pass-456",
  });
  record("Forced password confirmation mismatch is rejected", mismatch.status === 400, `status=${mismatch.status}`);
  await mismatch.arrayBuffer();

  const samePassword = await changeRequest({
    currentPassword: forced.plainPassword,
    password: forced.plainPassword,
    confirmPassword: forced.plainPassword,
  });
  record("Reusing the temporary password is rejected", samePassword.status === 400, `status=${samePassword.status}`);
  await samePassword.arrayBuffer();

  const newForcedPassword = "New-Secure-Pass-456";
  const changeSuccess = await changeRequest({
    currentPassword: forced.plainPassword,
    password: newForcedPassword,
    confirmPassword: newForcedPassword,
  });
  const changeSuccessBody = await json(changeSuccess);
  const refreshedForced = await prisma.user.findUniqueOrThrow({ where: { id: forced.id } });
  record("Forced password change succeeds", changeSuccess.status === 200 && changeSuccessBody.redirect === "/member", `status=${changeSuccess.status}`);
  record("Forced-change flag is cleared", !refreshedForced.mustChangePassword, `flag=${refreshedForced.mustChangePassword}`);
  record("Forced change increments sessionVersion", refreshedForced.sessionVersion === forced.sessionVersion + 1, `version=${refreshedForced.sessionVersion}`);
  record("New forced password uses bcrypt cost 12", refreshedForced.passwordHash.startsWith("$2") && refreshedForced.passwordHash.split("$")[2] === "12", "bcrypt cost inspected");
  record("Old temporary password no longer works", !(await bcrypt.compare(forced.plainPassword, refreshedForced.passwordHash)), "old password rejected by bcrypt");
  record("New forced password works", await bcrypt.compare(newForcedPassword, refreshedForced.passwordHash), "new password accepted by bcrypt");

  const staleForcedSession = await request("/api/notifications", { token: forcedToken });
  record("Old session is invalidated after forced change", staleForcedSession.status === 401, `status=${staleForcedSession.status}`);
  await staleForcedSession.arrayBuffer();
  record("Successful change issues a replacement session", Boolean(changeSuccess.headers.get("set-cookie")?.includes("ec_session=")), "Set-Cookie inspected");

  const regularMemberLogin = await request("/api/auth/login", {
    method: "POST",
    ip: `198.51.100.${randomInt(1, 240)}`,
    body: { email: defaultUser.email, password: defaultUser.plainPassword, portal: "member" },
  });
  const regularMemberBody = await json(regularMemberLogin);
  record("Normal member login remains unchanged", regularMemberLogin.status === 200 && regularMemberBody.redirect === "/member", `redirect=${String(regularMemberBody.redirect)}`);

  const regularStudent = await createUser("regular-student");
  const regularStudentLogin = await request("/api/auth/login", {
    method: "POST",
    ip: `198.51.100.${randomInt(1, 240)}`,
    body: { email: regularStudent.email, password: regularStudent.plainPassword, portal: "student" },
  });
  const regularStudentBody = await json(regularStudentLogin);
  record("Normal student login remains unchanged", regularStudentLogin.status === 200 && regularStudentBody.redirect === "/", `redirect=${String(regularStudentBody.redirect)}`);

  const knownForEnumeration = await createUser("enumeration-known");
  const adminForEnumeration = await createUser("enumeration-admin", { role: "ADMIN" });
  const knownEnumerationCode = await issuePasswordResetCode(
    knownForEnumeration.email,
  );
  if (knownEnumerationCode.status !== "ISSUED") {
    throw new Error("Enumeration test code was not prepared.");
  }
  const unknownEmail = `${prefix}-missing@gmail.com`;
  const enumerationIp = `192.0.2.${randomInt(1, 240)}`;
  const forgotResponses: Array<{ response: Response; body: Record<string, unknown> }> = [];
  for (const email of [knownForEnumeration.email, unknownEmail, adminForEnumeration.email]) {
    const fakeRequest = new Request(baseUrl, { headers: { "x-forwarded-for": enumerationIp } });
    trackRules(forgotPasswordRateLimitRules(fakeRequest, email));
    const response = await request("/api/auth/forgot-password", {
      method: "POST",
      ip: enumerationIp,
      body: { email },
    });
    forgotResponses.push({ response, body: await json(response) });
  }
  const genericMessages = forgotResponses.map((item) => item.body.message);
  record("Forgot-password prevents account enumeration", forgotResponses.every((item) => item.response.status === 200) && new Set(genericMessages).size === 1, `statuses=${forgotResponses.map((item) => item.response.status).join(",")}`);
  record("Forgot-password responses are no-store", forgotResponses.every((item) => item.response.headers.get("cache-control") === "private, no-store"), "all generic responses inspected");

  const crossOriginForgot = await request("/api/auth/forgot-password", {
    method: "POST",
    origin: "https://attacker.invalid",
    body: { email: unknownEmail },
  });
  record("Forgot-password rejects cross-origin requests", crossOriginForgot.status === 403, `status=${crossOriginForgot.status}`);
  record("Cross-origin auth denial is no-store", crossOriginForgot.headers.get("cache-control") === "no-store", `cache-control=${crossOriginForgot.headers.get("cache-control")}`);
  await crossOriginForgot.arrayBuffer();

  const otpUser = await createUser("otp");
  const issued = await issuePasswordResetCode(otpUser.email);
  if (issued.status !== "ISSUED") throw new Error(`Expected OTP issue, got ${issued.status}`);
  const storedOtp = await prisma.passwordResetCode.findUniqueOrThrow({ where: { userId: otpUser.id } });
  record("Reset OTP contains exactly six digits", /^\d{6}$/.test(issued.code), `length=${issued.code.length}`);
  record("Reset OTP is stored only as HMAC", storedOtp.codeHash !== issued.code && /^[a-f0-9]{64}$/.test(storedOtp.codeHash), "64-character digest stored");
  const ttlMinutes = (storedOtp.expiresAt.getTime() - storedOtp.lastSentAt.getTime()) / 60_000;
  record("Reset OTP expires after ten minutes", Math.abs(ttlMinutes - PASSWORD_RESET_CODE_TTL_MINUTES) < 0.1, `ttl=${ttlMinutes.toFixed(2)}m`);
  const cooldown = await issuePasswordResetCode(otpUser.email);
  record("Reset resend enforces 60-second cooldown", cooldown.status === "COOLDOWN" && cooldown.retryAfterSeconds > 0, `status=${cooldown.status}`);
  record("Only one active reset row exists per user", (await prisma.passwordResetCode.count({ where: { userId: otpUser.id } })) === 1, "row count=1");
  await prisma.passwordResetCode.update({
    where: { userId: otpUser.id },
    data: {
      lastSentAt: new Date(Date.now() - 61_000),
      windowStartedAt: new Date(),
      sendCount: 5,
    },
  });
  const hourlyLimit = await issuePasswordResetCode(otpUser.email);
  record(
    "Reset delivery enforces the hourly send window",
    hourlyLimit.status === "RATE_LIMITED" && hourlyLimit.retryAfterSeconds > 0,
    `status=${hourlyLimit.status}`,
  );

  const lockedUser = await createUser("locked");
  const lockedIssue = await issuePasswordResetCode(lockedUser.email);
  if (lockedIssue.status !== "ISSUED") throw new Error("Locked-user code was not issued.");
  for (let attempt = 1; attempt <= PASSWORD_RESET_MAX_ATTEMPTS; attempt += 1) {
    const result = await resetPasswordWithCode({
      normalizedEmail: lockedUser.email,
      code: wrongCode(lockedIssue.code),
      passwordHash: await hashPassword("Unused-New-Pass-456"),
    });
    const expected = attempt === PASSWORD_RESET_MAX_ATTEMPTS ? "TOO_MANY_ATTEMPTS" : "INVALID_CODE";
    record(`Wrong reset code attempt ${attempt}`, result.status === expected, `status=${result.status}`);
  }
  const correctAfterLock = await resetPasswordWithCode({
    normalizedEmail: lockedUser.email,
    code: lockedIssue.code,
    passwordHash: await hashPassword("Unused-New-Pass-456"),
  });
  record("Correct code is rejected after five failures", correctAfterLock.status === "TOO_MANY_ATTEMPTS", `status=${correctAfterLock.status}`);

  const expiredUser = await createUser("expired");
  const expiredIssue = await issuePasswordResetCode(expiredUser.email);
  if (expiredIssue.status !== "ISSUED") throw new Error("Expired-user code was not issued.");
  await prisma.passwordResetCode.update({ where: { userId: expiredUser.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  const expiredResult = await resetPasswordWithCode({
    normalizedEmail: expiredUser.email,
    code: expiredIssue.code,
    passwordHash: await hashPassword("Expired-New-Pass-456"),
  });
  record("Expired reset code is rejected", expiredResult.status === "EXPIRED", `status=${expiredResult.status}`);

  const resetUser = await createUser("reset-success", { role: "MEMBER", forced: true });
  const originalVerifiedAt = resetUser.emailVerifiedAt?.getTime();
  const resetIssue = await issuePasswordResetCode(resetUser.email);
  if (resetIssue.status !== "ISSUED") throw new Error("Success code was not issued.");
  const resetToken = await tokenFor(resetUser);
  const newResetPassword = "Reset-New-Pass-789";
  const resetResult = await resetPasswordWithCode({
    normalizedEmail: resetUser.email,
    code: resetIssue.code,
    passwordHash: await hashPassword(newResetPassword),
  });
  const afterReset = await prisma.user.findUniqueOrThrow({ where: { id: resetUser.id } });
  record("Valid reset code changes password", resetResult.status === "RESET", `status=${resetResult.status}`);
  record("Successful reset deletes the OTP", !(await prisma.passwordResetCode.findUnique({ where: { userId: resetUser.id } })), "OTP row absent");
  const replay = await resetPasswordWithCode({ normalizedEmail: resetUser.email, code: resetIssue.code, passwordHash: await hashPassword("Replay-New-Pass-789") });
  record("Reset OTP is single-use", replay.status === "CODE_NOT_FOUND", `status=${replay.status}`);
  record("Reset invalidates old password", !(await bcrypt.compare(resetUser.plainPassword, afterReset.passwordHash)), "old password rejected");
  record("Reset activates new password", await bcrypt.compare(newResetPassword, afterReset.passwordHash), "new password accepted");
  record("Reset clears forced-change flag", !afterReset.mustChangePassword, `flag=${afterReset.mustChangePassword}`);
  record("Reset increments sessionVersion", afterReset.sessionVersion === resetUser.sessionVersion + 1, `version=${afterReset.sessionVersion}`);
  record("Reset does not alter email verification", afterReset.emailVerifiedAt?.getTime() === originalVerifiedAt, "verification timestamp preserved");
  const staleResetSession = await request("/api/notifications", { token: resetToken });
  record("Reset invalidates existing sessions", staleResetSession.status === 401, `status=${staleResetSession.status}`);
  await staleResetSession.arrayBuffer();

  const concurrentUser = await createUser("concurrent");
  const concurrentIssue = await issuePasswordResetCode(concurrentUser.email);
  if (concurrentIssue.status !== "ISSUED") throw new Error("Concurrent code was not issued.");
  const concurrentResults = await Promise.allSettled(
    ["Concurrent-One-123", "Concurrent-Two-123"].map(async (password) =>
      resetPasswordWithCode({
        normalizedEmail: concurrentUser.email,
        code: concurrentIssue.code,
        passwordHash: await hashPassword(password),
      }),
    ),
  );
  const concurrentSuccesses = concurrentResults.filter(
    (result) => result.status === "fulfilled" && result.value.status === "RESET",
  ).length;
  record("Concurrent reset consumes code only once", concurrentSuccesses === 1 && concurrentResults.every((result) => result.status === "fulfilled"), `successes=${concurrentSuccesses}`);

  const unverified = await createUser("unverified", { verified: false });
  const unverifiedIssue = await issuePasswordResetCode(unverified.email);
  if (unverifiedIssue.status !== "ISSUED") throw new Error("Unverified code was not issued.");
  const unverifiedResult = await resetPasswordWithCode({
    normalizedEmail: unverified.email,
    code: unverifiedIssue.code,
    passwordHash: await hashPassword("Unverified-New-123"),
  });
  const unverifiedAfter = await prisma.user.findUniqueOrThrow({ where: { id: unverified.id } });
  record("Unverified account may reset its password", unverifiedResult.status === "RESET", `status=${unverifiedResult.status}`);
  record("Password reset does not verify an email", unverifiedAfter.emailVerifiedAt === null, `emailVerifiedAt=${unverifiedAfter.emailVerifiedAt}`);
  await prisma.emailVerificationCode.create({
    data: {
      userId: unverified.id,
      codeHash: "0".repeat(64),
      expiresAt: new Date(Date.now() + 10 * 60_000),
    },
  });
  const unverifiedLogin = await request("/api/auth/login", {
    method: "POST",
    ip: `192.0.2.${randomInt(1, 240)}`,
    body: {
      email: unverified.email,
      password: "Unverified-New-123",
      portal: "student",
    },
  });
  const unverifiedLoginBody = await json(unverifiedLogin);
  record(
    "Unverified reset account remains verification-gated at login",
    unverifiedLogin.status === 403 && unverifiedLoginBody.verificationRequired === true,
    `status=${unverifiedLogin.status}`,
  );

  const adminIssue = await issuePasswordResetCode(adminForEnumeration.email);
  record("Admin accounts are not eligible for public reset", adminIssue.status === "INELIGIBLE", `status=${adminIssue.status}`);

  const apiResetUser = await createUser("api-reset");
  const apiIssue = await issuePasswordResetCode(apiResetUser.email);
  if (apiIssue.status !== "ISSUED") throw new Error("API reset code was not issued.");
  const resetIp = `203.0.113.${randomInt(1, 240)}`;
  const fakeResetRequest = new Request(baseUrl, { headers: { "x-forwarded-for": resetIp } });
  trackRules(resetPasswordRateLimitRules(fakeResetRequest, apiResetUser.email));
  const invalidApiReset = await request("/api/auth/reset-password", {
    method: "POST",
    ip: resetIp,
    body: { email: apiResetUser.email, code: wrongCode(apiIssue.code), password: "API-New-Pass-123", confirmPassword: "API-New-Pass-123" },
  });
  const invalidApiBody = await json(invalidApiReset);
  record("Reset API returns a generic invalid-code error", invalidApiReset.status === 400 && invalidApiBody.error === "رمز التحقق غير صحيح أو انتهت صلاحيته.", `status=${invalidApiReset.status}`);
  record("Reset API error is no-store", invalidApiReset.headers.get("cache-control") === "private, no-store", `cache-control=${invalidApiReset.headers.get("cache-control")}`);

  const crossOriginReset = await request("/api/auth/reset-password", {
    method: "POST",
    origin: "https://attacker.invalid",
    body: { email: apiResetUser.email, code: apiIssue.code, password: "API-New-Pass-123", confirmPassword: "API-New-Pass-123" },
  });
  record("Reset API rejects cross-origin requests", crossOriginReset.status === 403, `status=${crossOriginReset.status}`);
  await crossOriginReset.arrayBuffer();

  const passwordResetSource = await readFile("app/api/auth/reset-password/route.ts", "utf8");
  const forgotSource = await readFile("app/api/auth/forgot-password/route.ts", "utf8");
  record("Public reset responses never expose OTP values", !passwordResetSource.includes("code: result") && !forgotSource.includes("code:"), "route response sources inspected");

  const failures = results.filter((result) => !result.ok);
  console.log(`\nPassword security tests: ${results.length - failures.length}/${results.length} passed.`);
  if (failures.length) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (rateLimitKeys.size) {
      await prisma.rateLimitCounter.deleteMany({ where: { key: { in: [...rateLimitKeys] } } }).catch(() => undefined);
    }
    if (createdUserIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });
