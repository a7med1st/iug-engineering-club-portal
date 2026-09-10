import assert from "node:assert/strict";
import { randomInt } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";

const prisma = new PrismaClient();
const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const origin = new URL(baseUrl).origin;
const secretValue = process.env.SESSION_SECRET;

if (!secretValue || secretValue.length < 32) {
  throw new Error("SESSION_SECRET is required for member-management tests.");
}

const jwtSecret = new TextEncoder().encode(secretValue);
const suffix = `${Date.now()}-${randomInt(1000, 9999)}`;
const prefix = `member-management-${suffix}`;

function actionName(formHtml) {
  const match = formHtml.match(/name="(\$ACTION_ID_[^"]+)"/);
  assert.ok(match, "Server-action identifier was not rendered in the form.");
  return match[1];
}

function findForm(html, requiredFragments) {
  const forms = [...html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)].map(
    (match) => match[1],
  );
  const form = forms.find((candidate) =>
    requiredFragments.every((fragment) => candidate.includes(fragment)),
  );
  assert.ok(
    form,
    `Expected form was not found (${requiredFragments.join(", ")}).`,
  );
  return form;
}

async function tokenFor(user) {
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

async function page(path, token) {
  const response = await fetch(new URL(path, baseUrl), {
    headers: { cookie: `ec_session=${token}` },
  });
  assert.equal(response.status, 200, `${path} must render successfully.`);
  return response.text();
}

async function submit(path, token, action, values) {
  const formData = new FormData();
  formData.append(action, "");

  for (const [name, value] of values) {
    formData.append(name, value);
  }

  const response = await fetch(new URL(path, baseUrl), {
    method: "POST",
    headers: {
      cookie: `ec_session=${token}`,
      origin,
    },
    body: formData,
    redirect: "manual",
  });

  assert.ok(
    [303, 307].includes(response.status),
    `${path} action must redirect after success (received ${response.status}).`,
  );
}

async function main() {
  let departmentId;

  try {
    const passwordHash = await bcrypt.hash("Test-Password-123", 12);
    const department = await prisma.department.create({
      data: {
        nameAr: `قسم اختبار الأعضاء ${suffix}`,
        nameEn: `Member management test ${suffix}`,
        slug: prefix,
        coverImage: "/images/departments/computer.png",
        sortOrder: 9999,
      },
    });
    departmentId = department.id;

    const admin = await prisma.user.create({
      data: {
        name: `Admin ${suffix}`,
        email: `${prefix}-admin@gmail.com`,
        emailVerifiedAt: new Date(),
        passwordHash,
        role: "ADMIN",
      },
    });
    const adminToken = await tokenFor(admin);

    const student = await prisma.user.create({
      data: {
        name: `Student ${suffix}`,
        email: `${prefix}-student@gmail.com`,
        emailVerifiedAt: new Date(),
        passwordHash,
        role: "STUDENT",
        studentNumber: String(randomInt(100000000, 999999999)),
        phone: "0599000000",
        studyLevel: "THIRD",
        departmentId,
        passwordResetCode: {
          create: {
            codeHash: "a".repeat(64),
            expiresAt: new Date(Date.now() + 600_000),
          },
        },
      },
    });

    const membersHtml = await page("/admin/members", adminToken);
    const createForm = findForm(membersHtml, [
      'name="email"',
      'name="password"',
      'name="role" value="MEMBER"',
    ]);
    const temporaryPassword = "Converted-Member-123";
    const convertedName = `Converted Member ${suffix}`;

    await submit(
      "/admin/members",
      adminToken,
      actionName(createForm),
      [
        ["name", convertedName],
        ["email", student.email],
        ["password", temporaryPassword],
        ["position", "عضو اختبار"],
        ["managedDepartmentIds", departmentId],
        ["role", "MEMBER"],
      ],
    );

    const converted = await prisma.user.findUniqueOrThrow({
      where: { id: student.id },
      include: { passwordResetCode: true },
    });
    assert.equal(converted.role, "MEMBER");
    assert.equal(converted.name, convertedName);
    assert.equal(converted.studentNumber, null);
    assert.equal(converted.phone, null);
    assert.equal(converted.studyLevel, null);
    assert.equal(converted.passwordResetCode, null);
    assert.equal(converted.mustChangePassword, true);
    assert.equal(converted.sessionVersion, student.sessionVersion + 1);
    assert.ok(await bcrypt.compare(temporaryPassword, converted.passwordHash));
    console.log("PASS  Existing student account converts to a member and clears student-only data.");

    const parentUser = await prisma.user.create({
      data: {
        name: `Parent ${suffix}`,
        email: `${prefix}-parent@gmail.com`,
        emailVerifiedAt: new Date(),
        passwordHash,
        role: "MEMBER",
        departmentId,
      },
    });
    const childUser = await prisma.user.create({
      data: {
        name: `Child ${suffix}`,
        email: `${prefix}-child@gmail.com`,
        emailVerifiedAt: new Date(),
        passwordHash,
        role: "MEMBER",
        departmentId,
      },
    });
    const grandchildUser = await prisma.user.create({
      data: {
        name: `Grandchild ${suffix}`,
        email: `${prefix}-grandchild@gmail.com`,
        emailVerifiedAt: new Date(),
        passwordHash,
        role: "MEMBER",
        departmentId,
      },
    });

    const parentItem = await prisma.clubStructureItem.create({
      data: {
        name: parentUser.name,
        title: "رئيس اختبار",
        userId: parentUser.id,
        departmentId,
        level: 1,
      },
    });
    const targetItem = await prisma.clubStructureItem.create({
      data: {
        name: converted.name,
        title: "عضو اختبار",
        userId: converted.id,
        departmentId,
        parentId: parentItem.id,
        level: 2,
      },
    });
    const childItem = await prisma.clubStructureItem.create({
      data: {
        name: childUser.name,
        title: "تابع اختبار",
        userId: childUser.id,
        departmentId,
        parentId: targetItem.id,
        level: 3,
      },
    });
    const grandchildItem = await prisma.clubStructureItem.create({
      data: {
        name: grandchildUser.name,
        title: "تابع فرعي اختبار",
        userId: grandchildUser.id,
        departmentId,
        parentId: childItem.id,
        level: 4,
      },
    });

    const structureHtml = await page("/admin/structure", adminToken);
    const updateForm = findForm(structureHtml, [
      `name="itemId" value="${targetItem.id}"`,
      "حفظ التعديل",
    ]);
    const renamedMember = `Renamed Member ${suffix}`;

    await submit(
      "/admin/structure",
      adminToken,
      actionName(updateForm),
      [
        ["itemId", targetItem.id],
        ["userId", converted.id],
        ["name", renamedMember],
        ["title", "عضو معدل"],
        ["parentId", parentItem.id],
      ],
    );

    const [renamedUser, renamedItem] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: converted.id } }),
      prisma.clubStructureItem.findUniqueOrThrow({ where: { id: targetItem.id } }),
    ]);
    assert.equal(renamedUser.name, renamedMember);
    assert.equal(renamedItem.name, renamedMember);
    console.log("PASS  Editing a structure member updates both account and structure names.");

    const refreshedStructureHtml = await page("/admin/structure", adminToken);
    const deleteForm = findForm(refreshedStructureHtml, [
      `name="itemId" value="${targetItem.id}"`,
      "حذف نهائيًا من الهيكلية",
    ]);

    await submit(
      "/admin/structure",
      adminToken,
      actionName(deleteForm),
      [["itemId", targetItem.id]],
    );

    const [deletedItem, movedChild, movedGrandchild, publicResponse] =
      await Promise.all([
        prisma.clubStructureItem.findUnique({ where: { id: targetItem.id } }),
        prisma.clubStructureItem.findUniqueOrThrow({ where: { id: childItem.id } }),
        prisma.clubStructureItem.findUniqueOrThrow({ where: { id: grandchildItem.id } }),
        fetch(new URL("/delegates", baseUrl)),
      ]);

    assert.equal(publicResponse.status, 200);
    const publicStructure = await publicResponse.text();
    assert.equal(deletedItem, null);
    assert.equal(movedChild.parentId, parentItem.id);
    assert.equal(movedChild.level, 2);
    assert.equal(movedGrandchild.parentId, childItem.id);
    assert.equal(movedGrandchild.level, 3);
    assert.ok(!publicStructure.includes(renamedMember));
    console.log("PASS  Permanent structure deletion hides the member and reparents descendants.");
  } finally {
    if (departmentId) {
      await prisma.clubStructureItem.deleteMany({ where: { departmentId } });
      await prisma.user.deleteMany({
        where: { email: { startsWith: prefix } },
      });
      await prisma.department.deleteMany({ where: { id: departmentId } });
    }
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
