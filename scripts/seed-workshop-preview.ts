import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
async function main() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (url.hostname !== "127.0.0.1" || url.port !== "55441" || url.pathname !== "/workshop_preview") {
    throw new Error("This seed is restricted to the local workshop preview database.");
  }
  const departments = [
    { slug: "computer-engineering", nameAr: "هندسة الحاسوب", nameEn: "Computer Engineering" },
    { slug: "ai-engineering", nameAr: "هندسة الذكاء الاصطناعي", nameEn: "Artificial Intelligence Engineering" },
    { slug: "architecture", nameAr: "الهندسة المعمارية", nameEn: "Architecture" },
    { slug: "civil-engineering", nameAr: "الهندسة المدنية", nameEn: "Civil Engineering" },
    { slug: "industrial-engineering", nameAr: "الهندسة الصناعية", nameEn: "Industrial Engineering" },
    { slug: "mechanical-engineering", nameAr: "الهندسة الميكانيكية", nameEn: "Mechanical Engineering" },
    { slug: "electrical-engineering", nameAr: "الهندسة الكهربائية", nameEn: "Electrical Engineering" },
    { slug: "intelligent-systems", nameAr: "هندسة النظم الذكية", nameEn: "Intelligent Systems Engineering" },
  ];
  for (const [index, department] of departments.entries()) {
    await prisma.department.upsert({
      where: { slug: department.slug },
      update: {},
      create: { ...department, sortOrder: index + 1, coverImage: `/images/departments/${["computer", "ai", "architecture", "civil", "industrial", "mechanical", "electrical", "intelligent-systems"][index]}.png` },
    });
  }
  const studentDepartment = await prisma.department.findUniqueOrThrow({ where: { slug: "computer-engineering" } });
  await prisma.user.upsert({
    where: { email: "student@example.com" },
    update: {},
    create: {
      name: "طالب التجربة", email: "student@example.com",
      passwordHash: await bcrypt.hash("StudentPreview2026!", 12),
      role: "STUDENT", emailVerifiedAt: new Date(), departmentId: studentDepartment.id,
    },
  });
  const admin = await prisma.user.upsert({
    where: { email: "preview@example.com" },
    update: {},
    create: { name: "مدير المعاينة", email: "preview@example.com", passwordHash: await bcrypt.hash("WorkshopPreview2026!", 12), role: "ADMIN", emailVerifiedAt: new Date() },
  });
  const activity = await prisma.activity.upsert({
    where: { id: "workshop-preview" }, update: {},
    create: {
      id: "workshop-preview", title: "ورشة تطوير تطبيقات الويب", description: "ورشة عملية من ثلاث جلسات", location: "مختبر الحاسوب", capacity: 30, requiredAttendanceCount: 3,
      sessions: { create: ["أساسيات الويب", "بناء التطبيق", "المشروع النهائي"].map((title, sortOrder) => ({ title, sortOrder })) },
      registrationForm: { create: { title: "التسجيل في ورشة الويب", opensAt: new Date("2026-01-01"), closesAt: new Date("2027-01-01") } },
    }, include: { sessions: { orderBy: { sortOrder: "asc" } }, registrationForm: true },
  });
  for (const [index, studentName] of ["أحمد", "محمد", "سارة"].entries()) {
    const id = "preview-student-" + index;
    await prisma.activityFormSubmission.upsert({
      where: { id }, update: {},
      create: { id, formId: activity.registrationForm!.id, studentName, studentEmail: id + "@example.com", status: "APPROVED", checkedInAt: new Date(), checkedInById: admin.id,
        sessionAttendances: { create: activity.sessions.slice(0, 3 - index).map(session => ({ sessionId: session.id, attendanceSource: "STAFF_MANUAL", checkedInById: admin.id })) } },
    });
  }
  console.log("Preview ready: workshop-preview");
}
main().finally(() => prisma.$disconnect());
