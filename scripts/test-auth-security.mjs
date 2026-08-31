import { randomInt } from "node:crypto";
import { readFile } from "node:fs/promises";

import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";

const prisma = new PrismaClient();
const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const origin = new URL(baseUrl).origin;
const secretValue = process.env.SESSION_SECRET;

if (!secretValue || secretValue.length < 32) {
  throw new Error("SESSION_SECRET must be configured for auth security tests.");
}

const secret = new TextEncoder().encode(secretValue);
const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} - ${detail}`);
}

async function createToken(user, overrides = {}) {
  return new SignJWT({
    email: user.email,
    name: user.name,
    role: overrides.role ?? user.role,
    sessionVersion:
      overrides.sessionVersion ?? user.sessionVersion,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuer("iug-engineering-club-portal")
    .setAudience("iug-engineering-club-web")
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(secret);
}

async function request(path, options = {}) {
  const method = options.method ?? "GET";

  return fetch(new URL(path, baseUrl), {
    method,
    redirect: "manual",
    headers: {
      ...(!["GET", "HEAD", "OPTIONS"].includes(method)
        ? { origin }
        : {}),
      ...(options.ip ? { "x-forwarded-for": options.ip } : {}),
      ...(options.token
        ? { cookie: `ec_session=${options.token}` }
        : {}),
      ...(options.headers ?? {}),
    },
    body: options.body,
  });
}

async function main() {
  const [student, member, admin] = await Promise.all([
    prisma.user.findFirst({
      where: { role: "STUDENT" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        sessionVersion: true,
      },
    }),
    prisma.user.findFirst({
      where: { role: "MEMBER" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        sessionVersion: true,
      },
    }),
    prisma.user.findFirst({
      where: { role: "ADMIN" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        sessionVersion: true,
      },
    }),
  ]);

  if (!student || !member || !admin) {
    throw new Error("Auth tests require STUDENT, MEMBER, and ADMIN users.");
  }

  const loginEmail = process.env.SEED_ADMIN_EMAIL;
  const loginPassword = process.env.SEED_ADMIN_PASSWORD;

  if (!loginEmail || !loginPassword) {
    record(
      "Valid login",
      false,
      "SEED_ADMIN_EMAIL or SEED_ADMIN_PASSWORD is missing",
    );
  } else {
    const validLoginResponse = await request("/api/auth/login", {
      method: "POST",
      ip: `203.0.113.${randomInt(1, 250)}`,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: loginEmail,
        password: loginPassword,
        portal: "member",
      }),
    });
    record(
      "Valid login",
      validLoginResponse.status === 200,
      `status=${validLoginResponse.status}`,
    );
    await validLoginResponse.arrayBuffer();
  }

  const testIp = `198.51.100.${randomInt(1, 250)}`;
  const randomEmail = `rate-limit-${Date.now()}@example.invalid`;
  const loginBody = JSON.stringify({
    email: randomEmail,
    password: "definitely-wrong-password",
    portal: "student",
  });

  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const response = await request("/api/auth/login", {
      method: "POST",
      ip: testIp,
      headers: { "content-type": "application/json" },
      body: loginBody,
    });
    const expectedStatus = attempt <= 7 ? 401 : 429;
    record(
      `Login failure ${attempt}`,
      response.status === expectedStatus,
      `status=${response.status} expected=${expectedStatus}`,
    );

    if (attempt === 8) {
      record(
        "Rate limit Retry-After",
        Number(response.headers.get("retry-after")) > 0,
        `retry-after=${response.headers.get("retry-after")}`,
      );
    }

    await response.arrayBuffer();
  }

  const staleVersionToken = await createToken(member, {
    sessionVersion: member.sessionVersion + 1,
  });
  const staleVersionResponse = await request("/api/member/chat/groups", {
    token: staleVersionToken,
  });
  record(
    "Session version mismatch",
    staleVersionResponse.status === 401,
    `status=${staleVersionResponse.status}`,
  );
  await staleVersionResponse.arrayBuffer();

  const staleRoleToken = await createToken(student, { role: "MEMBER" });
  const staleRoleResponse = await request("/api/member/chat/groups", {
    token: staleRoleToken,
  });
  record(
    "Downgraded member loses chat access",
    staleRoleResponse.status === 403,
    `status=${staleRoleResponse.status}`,
  );
  await staleRoleResponse.arrayBuffer();

  const studentToken = await createToken(student);
  const studentAdminResponse = await request("/admin/members", {
    token: studentToken,
  });
  record(
    "Student denied admin members",
    [303, 307, 308].includes(studentAdminResponse.status),
    `status=${studentAdminResponse.status}`,
  );
  await studentAdminResponse.arrayBuffer();

  const memberToken = await createToken(member);
  const memberAdminResponse = await request("/admin/members", {
    token: memberToken,
  });
  record(
    "Member denied admin member management",
    [303, 307, 308].includes(memberAdminResponse.status),
    `status=${memberAdminResponse.status}`,
  );
  await memberAdminResponse.arrayBuffer();

  const adminToken = await createToken(admin);
  const adminResponse = await request("/admin/members", {
    token: adminToken,
  });
  record(
    "Admin access remains valid",
    adminResponse.status === 200,
    `status=${adminResponse.status}`,
  );
  await adminResponse.arrayBuffer();

  const notificationsResponse = await request(
    "/api/notifications?limit=10",
    { token: adminToken },
  );
  record(
    "Private notifications cache control",
    notificationsResponse.status === 200 &&
      notificationsResponse.headers.get("cache-control") ===
        "private, no-store" &&
      (notificationsResponse.headers.get("content-type") ?? "").startsWith(
        "application/json",
      ),
    `status=${notificationsResponse.status} cache-control=${notificationsResponse.headers.get("cache-control")}`,
  );
  await notificationsResponse.arrayBuffer();

  const chatGroupsResponse = await request("/api/member/chat/groups", {
    token: memberToken,
  });
  record(
    "Private chat groups cache control",
    chatGroupsResponse.status === 200 &&
      chatGroupsResponse.headers.get("cache-control") ===
        "private, no-store" &&
      (chatGroupsResponse.headers.get("content-type") ?? "").startsWith(
        "application/json",
      ),
    `status=${chatGroupsResponse.status} cache-control=${chatGroupsResponse.headers.get("cache-control")}`,
  );
  await chatGroupsResponse.arrayBuffer();

  const additionalPrivateRoutes = [
    "app/api/member/presence/route.ts",
    "app/member/chat/[id]/typing/route.ts",
    "app/member/chat/[id]/group-status/route.ts",
    "app/member/chat/[id]/status/route.ts",
    "app/member/chat/[id]/read/route.ts",
  ];
  const missingPrivateCacheGuards = [];

  for (const routePath of additionalPrivateRoutes) {
    const source = await readFile(routePath, "utf8");
    if (!source.includes("privateNoStoreJson(")) {
      missingPrivateCacheGuards.push(routePath);
    }
  }

  record(
    "Additional private API cache guards",
    missingPrivateCacheGuards.length === 0,
    missingPrivateCacheGuards.length === 0
      ? `${additionalPrivateRoutes.length}/${additionalPrivateRoutes.length} guarded`
      : `missing=${missingPrivateCacheGuards.join(",")}`,
  );

  const crossOriginResponse = await fetch(
    new URL("/api/notifications", baseUrl),
    {
      method: "POST",
      redirect: "manual",
      headers: {
        origin: "https://attacker.invalid",
        cookie: `ec_session=${adminToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ all: true }),
    },
  );
  record(
    "Cross-origin mutation rejected",
    crossOriginResponse.status === 403,
    `status=${crossOriginResponse.status}`,
  );
  await crossOriginResponse.arrayBuffer();

  const sameOriginResponse = await request("/api/notifications", {
    method: "POST",
    token: adminToken,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  record(
    "Same-origin mutation reaches handler",
    sameOriginResponse.status === 400,
    `status=${sameOriginResponse.status}`,
  );
  await sameOriginResponse.arrayBuffer();

  const logoutResponse = await request("/api/auth/logout", {
    method: "POST",
    token: adminToken,
  });
  record(
    "Current-device logout",
    logoutResponse.status === 303 &&
      logoutResponse.headers.get("location") === "/" &&
      (logoutResponse.headers.get("set-cookie") ?? "").includes(
        "ec_session=",
      ),
    `status=${logoutResponse.status}`,
  );
  await logoutResponse.arrayBuffer();

  const failed = results.filter((result) => !result.ok);
  console.log(
    `\nAuth security test result: ${results.length - failed.length}/${results.length} passed.`,
  );

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
