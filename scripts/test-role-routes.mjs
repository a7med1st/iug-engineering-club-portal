import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";

const prisma = new PrismaClient();
const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const secretValue = process.env.SESSION_SECRET;

if (!secretValue || secretValue.length < 32) {
  throw new Error("SESSION_SECRET must be configured for route tests.");
}

const secret = new TextEncoder().encode(secretValue);
const results = [];
const assetUrls = new Set();
const requiredSecurityHeaders = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-frame-options": "DENY",
  "permissions-policy": "camera=(self), microphone=(self), geolocation=()",
};

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — ${detail}`);
}

async function createToken(user) {
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
    .setExpirationTime("10m")
    .sign(secret);
}

async function request(name, path, options = {}) {
  const {
    token,
    expected = [200],
    method = "GET",
    headers = {},
    expectedHeaders = {},
    body,
    collectAssets = true,
  } = options;
  const response = await fetch(new URL(path, baseUrl), {
    method,
    headers: {
      ...(!["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())
        ? { origin: new URL(baseUrl).origin }
        : {}),
      ...headers,
      ...(token ? { cookie: `ec_session=${token}` } : {}),
    },
    body,
    redirect: "manual",
  });
  const contentType = response.headers.get("content-type") || "";
  const headerProblems = Object.entries(requiredSecurityHeaders)
    .filter(([key, value]) => response.headers.get(key) !== value)
    .map(([key]) => key);
  for (const [key, expectedValue] of Object.entries(expectedHeaders)) {
    const actualValue = response.headers.get(key) || "";
    if (!actualValue.toLowerCase().includes(String(expectedValue).toLowerCase())) {
      headerProblems.push(`${key}-mismatch`);
    }
  }
  if (response.headers.has("x-powered-by")) headerProblems.push("x-powered-by-present");
  const ok = expected.includes(response.status) && headerProblems.length === 0;
  record(
    name,
    ok,
    `status=${response.status}${response.headers.get("location") ? ` location=${response.headers.get("location")}` : ""}${headerProblems.length ? ` security-headers=${headerProblems.join(",")}` : ""}`,
  );

  if (collectAssets && response.status === 200 && contentType.includes("text/html")) {
    const html = await response.text();
    for (const match of html.matchAll(/(?:href|src)="([^"]+\.(?:css|js)(?:\?[^"]*)?)"/g)) {
      if (match[1].startsWith("/_next/")) assetUrls.add(match[1]);
    }
  } else {
    await response.arrayBuffer();
  }

  return response;
}

async function main() {
  const [
    student,
    admin,
    member,
    department,
    activity,
    publicMember,
    certificate,
    group,
    complaint,
    suggestion,
    collaboration,
    checkInActivity,
  ] =
    await Promise.all([
      prisma.user.findFirst({
        where: { role: "STUDENT" },
        select: { id: true, email: true, name: true, role: true, sessionVersion: true, avatarStoredName: true },
      }),
      prisma.user.findFirst({
        where: { role: "ADMIN" },
        select: { id: true, email: true, name: true, role: true, sessionVersion: true },
      }),
      prisma.user.findFirst({
        where: { role: "MEMBER" },
        select: { id: true, email: true, name: true, role: true, sessionVersion: true },
      }),
      prisma.department.findFirst({ select: { slug: true } }),
      prisma.activity.findFirst({
        orderBy: { createdAt: "desc" },
        select: { id: true },
      }),
      prisma.user.findFirst({
        where: { role: { in: ["MEMBER", "ADMIN"] }, structureItem: { isNot: null } },
        select: { id: true, avatarStoredName: true, profileCoverStoredName: true },
      }),
      prisma.certificate.findFirst({ select: { verificationCode: true } }),
      prisma.chatConversation.findFirst({
        where: { type: "GROUP", directKey: { startsWith: "group:" } },
        select: { id: true },
      }),
      prisma.complaint.findFirst({ select: { id: true } }),
      prisma.suggestion.findFirst({ select: { id: true } }),
      prisma.collaborationRequest.findFirst({
        select: { id: true, attachmentStoredName: true },
      }),
      prisma.activity.findFirst({
        where: { status: "PUBLISHED", registrationForm: { isNot: null } },
        select: { id: true },
      }),
    ]);

  if (!student || !admin) {
    throw new Error("Route tests require at least one STUDENT and one ADMIN account.");
  }

  const [studentToken, adminToken, memberToken] = await Promise.all([
    createToken(student),
    createToken(admin),
    member ? createToken(member) : null,
  ]);

  const publicRoutes = [
    ["Public home", "/"],
    ["Public about", "/about"],
    ["Public activities", "/activities"],
    ["Public departments", "/departments"],
    ["Public delegates", "/delegates"],
    ["Public contact", "/contact"],
    ["Student login", "/login?portal=student"],
    ["Member login", "/login?portal=member"],
    ["Student registration", "/student/register"],
    ["Certificate verification home", "/certificates/verify"],
  ];

  if (department) publicRoutes.push(["Department details", `/departments/${department.slug}`]);
  if (activity) publicRoutes.push(["Activity details", `/activities/${activity.id}`]);
  if (publicMember) publicRoutes.push(["Public member profile", `/members/${publicMember.id}`]);
  if (publicMember?.avatarStoredName) {
    publicRoutes.push(["Public member avatar", `/members/${publicMember.id}/avatar`]);
  }
  if (publicMember?.profileCoverStoredName) {
    publicRoutes.push(["Public member cover", `/members/${publicMember.id}/cover`]);
  }
  if (certificate) {
    publicRoutes.push(
      ["Public certificate", `/certificates/${certificate.verificationCode}`],
      ["Certificate verification result", `/certificates/verify/${certificate.verificationCode}`],
    );
  }

  for (const [name, path] of publicRoutes) await request(name, path);

  await request("Email verification page requires verification session", "/verify-email", {
    expected: [303, 307, 308],
  });

  await request("Unauthenticated student guard", "/student", { expected: [303, 307, 308] });
  await request("Unauthenticated admin guard", "/admin/activities", { expected: [303, 307, 308] });
  await request("Unauthenticated notifications API", "/api/notifications", { expected: [401] });
  await request("Invalid login rejection", "/api/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": `192.0.2.${Math.floor(Math.random() * 250) + 1}`,
    },
    body: JSON.stringify({ email: `missing-user-${Date.now()}@gmail.com`, password: "invalid-password", portal: "student" }),
    expected: [401],
  });
  await request("Protected cron rejection", "/api/cron/activity-reminders", { expected: [401] });
  await request("Invalid student registration rejection", "/api/auth/register-student", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 250) + 1}`,
    },
    body: JSON.stringify({}),
    expected: [400],
  });
  await request("Verification resend requires session", "/api/auth/resend-verification", {
    method: "POST",
    expected: [401],
  });
  await request("Email verification requires session", "/api/auth/verify-email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code: "000000" }),
    expected: [401],
  });
  await request("Logout endpoint", "/api/auth/logout", {
    method: "POST",
    token: adminToken,
    expected: [303],
  });

  const studentRoutes = [
    ["Student dashboard", "/student"],
    ["Student upcoming activities tab", "/student?activityTab=upcoming"],
    ["Student past activities tab", "/student?activityTab=past"],
    ["Student rejected activities tab", "/student?activityTab=rejected"],
    ["Student certificates", "/student/certificates"],
    ["Student notifications", "/notifications"],
  ];
  if (activity) studentRoutes.push(["Student activity registration page", `/activities/${activity.id}/register`]);

  for (const [name, path] of studentRoutes) {
    await request(name, path, { token: studentToken, expected: [200, 303, 307, 308] });
  }

  await request("Student notifications API", "/api/notifications?limit=5", { token: studentToken });
  await request("Student forbidden from member groups API", "/api/member/chat/groups", {
    token: studentToken,
    expected: [403],
  });
  await request("Student forbidden from admin", "/admin/activities", {
    token: studentToken,
    expected: [303, 307, 308],
  });
  await request("Student invalid notification mutation", "/api/notifications", {
    token: studentToken,
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
    expected: [400],
  });
  if (student.avatarStoredName) {
    await request("Student avatar", "/student/avatar", { token: studentToken, collectAssets: false });
  }

  const adminRoutes = [
    ["Admin landing redirect", "/admin", [303, 307, 308]],
    ["Admin activities", "/admin/activities", [200]],
    ["Admin members", "/admin/members", [200]],
    ["Admin structure", "/admin/structure", [200]],
    ["Admin guides", "/admin/guides", [200]],
    ["Admin contact", "/admin/contact", [200]],
    ["Admin certificates", "/admin/certificates", [200]],
    ["Admin dashboard", "/admin/dashboard", [200]],
    ["Admin reports", "/admin/reports", [200]],
    ["Admin report print", "/admin/reports/print", [200]],
    ["Admin member dashboard", "/member", [200]],
    ["Admin member profile", "/member/profile", [200]],
    ["Admin member chat", "/member/chat", [200]],
    ["Admin member groups", "/member/chat/groups", [200]],
    ["Admin attendance scanner", "/member/check-in", [200]],
    ["Admin notifications", "/notifications", [200]],
  ];
  if (activity) {
    adminRoutes.push(
      ["Admin activity registrations", `/admin/activities/${activity.id}/registrations`, [200]],
      ["Admin activity check-in", `/admin/activities/${activity.id}/check-in`, [200]],
      ["Admin activity documentation", `/admin/activities/${activity.id}/documentation`, [200]],
    );
  }
  if (group) adminRoutes.push(["Admin group conversation", `/member/chat/groups/${group.id}`, [200]]);
  if (checkInActivity) {
    adminRoutes.push([
      "Admin member activity check-in",
      `/member/check-in/${checkInActivity.id}`,
      [200],
    ]);
  }
  if (complaint) {
    adminRoutes.push(["Admin complaint print", `/admin/contact/print/complaint/${complaint.id}`, [200]]);
  }
  if (suggestion) {
    adminRoutes.push(["Admin suggestion print", `/admin/contact/print/suggestion/${suggestion.id}`, [200]]);
  }
  if (collaboration) {
    adminRoutes.push([
      "Admin collaboration print",
      `/admin/contact/print/collaboration/${collaboration.id}`,
      [200],
    ]);
  }

  const adminDirectConversation = await prisma.chatConversation.findFirst({
    where: {
      type: "DIRECT",
      participants: { some: { userId: admin.id } },
    },
    select: { id: true },
  });
  if (adminDirectConversation) {
    adminRoutes.push([
      "Admin direct conversation",
      `/member/chat/${adminDirectConversation.id}`,
      [200],
    ]);
  }

  for (const [name, path, expected] of adminRoutes) {
    await request(name, path, { token: adminToken, expected });
  }

  await request("Admin groups API", "/api/member/chat/groups", { token: adminToken });
  await request("Admin notifications API", "/api/notifications?limit=50", { token: adminToken });
  await request("Admin presence heartbeat", "/api/member/presence", {
    token: adminToken,
    method: "POST",
    expected: [200],
  });
  await request("Unknown chat status rejected", "/member/chat/route-test-missing/status", {
    token: adminToken,
    expected: [404],
  });
  await request("Unknown chat typing rejected", "/member/chat/route-test-missing/typing", {
    token: adminToken,
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ active: false }),
    expected: [404],
  });
  await request("Unknown chat read rejected", "/member/chat/route-test-missing/read", {
    token: adminToken,
    method: "POST",
    expected: [404],
  });
  await request("Unknown group status rejected", "/member/chat/route-test-missing/group-status", {
    token: adminToken,
    expected: [404],
  });
  await request("Unknown chat attachment rejected", "/member/chat/attachments/route-test-missing", {
    token: adminToken,
    expected: [404],
    collectAssets: false,
  });
  if (collaboration?.attachmentStoredName) {
    await request("Admin contact attachment", `/admin/contact/files/${collaboration.id}`, {
      token: adminToken,
      expected: [200],
      expectedHeaders: { "content-disposition": "attachment" },
      collectAssets: false,
    });
  }
  const adminChatAttachment = await prisma.chatAttachment.findFirst({
    where: {
      message: {
        conversation: { participants: { some: { userId: admin.id } } },
      },
    },
    select: { id: true },
  });
  if (adminChatAttachment) {
    await request("Admin chat attachment", `/member/chat/attachments/${adminChatAttachment.id}`, {
      token: adminToken,
      expected: [200, 206],
      expectedHeaders: { "content-disposition": "filename" },
      collectAssets: false,
    });
  }
  await request("Admin reports export", "/admin/reports/export", {
    token: adminToken,
    expected: [200],
    expectedHeaders: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": "attachment",
    },
    collectAssets: false,
  });
  await request("Admin complaints export", "/admin/contact/export/complaints", {
    token: adminToken,
    expected: [200],
    expectedHeaders: { "content-type": "spreadsheetml.sheet", "content-disposition": "attachment" },
    collectAssets: false,
  });
  await request("Admin suggestions export", "/admin/contact/export/suggestions", {
    token: adminToken,
    expected: [200],
    expectedHeaders: { "content-type": "spreadsheetml.sheet", "content-disposition": "attachment" },
    collectAssets: false,
  });
  await request("Admin collaborations export", "/admin/contact/export/collaborations", {
    token: adminToken,
    expected: [200],
    expectedHeaders: { "content-type": "spreadsheetml.sheet", "content-disposition": "attachment" },
    collectAssets: false,
  });
  if (activity) {
    await request("Admin registrations export", `/admin/activities/${activity.id}/registrations/export`, {
      token: adminToken,
      expected: [200],
      expectedHeaders: { "content-type": "spreadsheetml.sheet", "content-disposition": "attachment" },
      collectAssets: false,
    });
  }

  await request("Admin can inspect student dashboard", "/student", {
    token: adminToken,
    expected: [200],
  });

  if (memberToken) {
    await request("Member dashboard", "/member", { token: memberToken });
    await request("Member profile", "/member/profile", { token: memberToken });
    await request("Member chat", "/member/chat", { token: memberToken });
    await request("Member groups API", "/api/member/chat/groups", { token: memberToken });
    const memberDirectConversation = await prisma.chatConversation.findFirst({
      where: {
        type: "DIRECT",
        participants: { some: { userId: member.id } },
      },
      select: { id: true },
    });
    if (memberDirectConversation) {
      await request("Member direct conversation", `/member/chat/${memberDirectConversation.id}`, {
        token: memberToken,
      });
      await request("Member direct chat status", `/member/chat/${memberDirectConversation.id}/status`, {
        token: memberToken,
      });
    }
  }

  for (const assetPath of assetUrls) {
    const response = await fetch(new URL(assetPath, baseUrl));
    const contentType = response.headers.get("content-type") || "";
    const expectedType = assetPath.includes(".css") ? "text/css" : "javascript";
    const ok = response.status === 200 && contentType.includes(expectedType);
    record("Static asset", ok, `${assetPath} status=${response.status} type=${contentType}`);
    await response.arrayBuffer();
  }

  const failed = results.filter((result) => !result.ok);
  console.log(`\nRoute test result: ${results.length - failed.length}/${results.length} passed.`);
  if (failed.length) process.exitCode = 1;
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
