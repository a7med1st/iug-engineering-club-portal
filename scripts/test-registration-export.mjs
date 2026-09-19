import assert from "node:assert/strict";
import { randomInt } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";
import { SignJWT } from "jose";

const prisma = new PrismaClient();
const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const secretValue = process.env.SESSION_SECRET;

if (!secretValue || secretValue.length < 32) {
  throw new Error("SESSION_SECRET is required for registration-export tests.");
}

const jwtSecret = new TextEncoder().encode(secretValue);
const suffix = `${Date.now()}-${randomInt(1000, 9999)}`;
const prefix = `registration-export-${suffix}`;

async function deleteTestActivity(activityId) {
  const submissions = await prisma.activityFormSubmission.findMany({
    where: {
      form: { activityId },
    },
    select: { id: true },
  });

  if (submissions.length) {
    await prisma.activityFormAnswer.deleteMany({
      where: {
        submissionId: {
          in: submissions.map((submission) => submission.id),
        },
      },
    });
  }

  await prisma.activity.deleteMany({ where: { id: activityId } });
}

async function deleteStaleTestData() {
  const departments = await prisma.department.findMany({
    where: { slug: { startsWith: "registration-export-" } },
    select: {
      id: true,
      activities: {
        select: { activityId: true },
      },
    },
  });

  for (const department of departments) {
    for (const activity of department.activities) {
      await deleteTestActivity(activity.activityId);
    }
  }

  await prisma.user.deleteMany({
    where: { email: { startsWith: "registration-export-" } },
  });
  await prisma.department.deleteMany({
    where: { slug: { startsWith: "registration-export-" } },
  });
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

async function download(path, token) {
  const response = await fetch(new URL(path, baseUrl), {
    headers: { cookie: `ec_session=${token}` },
  });

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/,
  );
  assert.match(response.headers.get("content-disposition") ?? "", /attachment/);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()));
  const worksheet = workbook.getWorksheet("المسجلون");
  assert.ok(worksheet, "The registrations worksheet must exist.");

  return { response, worksheet };
}

async function main() {
  let activityId;
  let departmentId;

  try {
    await deleteStaleTestData();

    const department = await prisma.department.create({
      data: {
        nameAr: `قسم تصدير تجريبي ${suffix}`,
        nameEn: `Export test ${suffix}`,
        slug: prefix,
        coverImage: "/images/departments/computer.png",
        sortOrder: 9999,
      },
    });
    departmentId = department.id;

    const admin = await prisma.user.create({
      data: {
        name: `Export Admin ${suffix}`,
        email: `${prefix}@gmail.com`,
        emailVerifiedAt: new Date(),
        passwordHash: "test-only-password-hash",
        role: "ADMIN",
      },
    });
    const token = await tokenFor(admin);

    const activity = await prisma.activity.create({
      data: {
        title: `نشاط تصدير ${suffix}`,
        description: "نشاط مخصص لاختبار تصدير Excel.",
        location: "قاعة الاختبار",
        capacity: 20,
        status: "PUBLISHED",
        departments: {
          create: { departmentId },
        },
        registrationForm: {
          create: {
            title: "نموذج اختبار التصدير",
            description: "",
            opensAt: new Date(Date.now() - 3_600_000),
            closesAt: new Date(Date.now() + 3_600_000),
            questions: {
              create: [
                {
                  label: "المهارة الأساسية",
                  type: "SHORT_TEXT",
                  required: true,
                  sortOrder: 0,
                },
                {
                  label: "المجالات المفضلة",
                  type: "CHECKBOX",
                  required: false,
                  options: ["الويب", "الذكاء الاصطناعي"],
                  sortOrder: 1,
                },
              ],
            },
          },
        },
      },
      include: {
        registrationForm: {
          include: { questions: { orderBy: { sortOrder: "asc" } } },
        },
      },
    });
    activityId = activity.id;

    const form = activity.registrationForm;
    assert.ok(form);
    const [skillQuestion, fieldsQuestion] = form.questions;

    const submissions = [
      {
        studentName: `Needle Student ${suffix}`,
        studentEmail: `${prefix}-present@gmail.com`,
        studentDepartment: "هندسة الحاسوب",
        status: "APPROVED",
        checkedInAt: new Date(),
        skill: "React",
        fields: ["الويب", "الذكاء الاصطناعي"],
      },
      {
        studentName: `Absent Student ${suffix}`,
        studentEmail: `${prefix}-absent@gmail.com`,
        studentDepartment: "الهندسة المدنية",
        status: "APPROVED",
        checkedInAt: null,
        skill: "AutoCAD",
        fields: ["الويب"],
      },
      {
        studentName: `Pending Student ${suffix}`,
        studentEmail: `${prefix}-pending@gmail.com`,
        studentDepartment: "الهندسة الصناعية",
        status: "SUBMITTED",
        checkedInAt: null,
        skill: "Planning",
        fields: [],
      },
    ];

    for (const submission of submissions) {
      await prisma.activityFormSubmission.create({
        data: {
          formId: form.id,
          studentName: submission.studentName,
          studentEmail: submission.studentEmail,
          studentDepartment: submission.studentDepartment,
          status: submission.status,
          checkedInAt: submission.checkedInAt,
          answers: {
            create: [
              {
                questionId: skillQuestion.id,
                value: submission.skill,
              },
              {
                questionId: fieldsQuestion.id,
                value: submission.fields,
              },
            ],
          },
        },
      });
    }

    const allExport = await download(
      `/admin/activities/${activity.id}/registrations/export`,
      token,
    );
    assert.equal(allExport.worksheet.rowCount, 4);
    assert.equal(allExport.worksheet.getCell("I1").value, "المهارة الأساسية");
    assert.equal(allExport.worksheet.getCell("J1").value, "المجالات المفضلة");
    console.log("PASS  Excel export contains every registration and dynamic form question.");

    const filteredExport = await download(
      `/admin/activities/${activity.id}/registrations/export?q=Needle&status=APPROVED&attendance=PRESENT`,
      token,
    );
    assert.equal(filteredExport.worksheet.rowCount, 2);
    assert.equal(filteredExport.worksheet.getCell("B2").value, submissions[0].studentName);
    assert.equal(filteredExport.worksheet.getCell("E2").value, "مقبول");
    assert.equal(filteredExport.worksheet.getCell("F2").value, "حضر");
    assert.equal(filteredExport.worksheet.getCell("I2").value, "React");
    assert.equal(
      filteredExport.worksheet.getCell("J2").value,
      "الويب، الذكاء الاصطناعي",
    );
    assert.equal(filteredExport.worksheet.views[0]?.rightToLeft, true);
    assert.match(
      filteredExport.response.headers.get("content-disposition") ?? "",
      /filtered-registrations\.xlsx/,
    );
    console.log("PASS  Excel export matches search, status, and attendance filters.");
  } finally {
    if (activityId) {
      await deleteTestActivity(activityId);
    }
    await prisma.user.deleteMany({
      where: { email: { startsWith: prefix } },
    });
    if (departmentId) {
      await prisma.department.deleteMany({ where: { id: departmentId } });
    }
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
