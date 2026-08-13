import { PrismaClient, Role, ActivityStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const departments = [
  { slug: "computer-engineering", nameAr: "هندسة الحاسوب", nameEn: "Computer Engineering", coverImage: "/images/departments/computer.png", sortOrder: 1 },
  { slug: "ai-engineering", nameAr: "هندسة الذكاء الصناعي", nameEn: "Artificial Intelligence Engineering", coverImage: "/images/departments/ai.png", sortOrder: 2 },
  { slug: "architecture", nameAr: "الهندسة المعمارية", nameEn: "Architecture", coverImage: "/images/departments/architecture.png", sortOrder: 3 },
  { slug: "civil-engineering", nameAr: "الهندسة المدنية", nameEn: "Civil Engineering", coverImage: "/images/departments/civil.png", sortOrder: 4 },
  { slug: "industrial-engineering", nameAr: "الهندسة الصناعية", nameEn: "Industrial Engineering", coverImage: "/images/departments/industrial.png", sortOrder: 5 },
  { slug: "mechanical-engineering", nameAr: "الهندسة الميكانيكية", nameEn: "Mechanical Engineering", coverImage: "/images/departments/mechanical.png", sortOrder: 6 },
  { slug: "electrical-engineering", nameAr: "الهندسة الكهربائية", nameEn: "Electrical Engineering", coverImage: "/images/departments/electrical.png", sortOrder: 7 },
  { slug: "intelligent-systems", nameAr: "هندسة النظم الذكية", nameEn: "Intelligent Systems Engineering", coverImage: "/images/departments/intelligent-systems.png", sortOrder: 8 }
];

async function main() {
  for (const d of departments) {
    const dep = await prisma.department.upsert({
      where: { slug: d.slug },
      update: d,
      create: d,
    });
    await prisma.departmentGuide.upsert({
      where: { departmentId: dep.id },
      update: {},
      create: { departmentId: dep.id },
    });
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;

  if (Boolean(adminEmail) !== Boolean(adminPassword)) {
    throw new Error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be provided together.");
  }

  if (adminEmail && adminPassword) {
    if (adminPassword.length < 12) {
      throw new Error("SEED_ADMIN_PASSWORD must contain at least 12 characters.");
    }

    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: { role: Role.ADMIN, name: "مدير النادي الهندسي", passwordHash },
      create: { name: "مدير النادي الهندسي", email: adminEmail, passwordHash, role: Role.ADMIN },
    });
  } else {
    console.log("Admin seed skipped: set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to create one.");
  }

  const count = await prisma.activity.count();
  if (count === 0) {
    const computer = await prisma.department.findUnique({ where: { slug: "computer-engineering" } });
    await prisma.$transaction(async (tx) => {
      await tx.activity.create({
        data: {
          title: "جلسة مهارات سوق العمل الهندسي",
          description: "جلسة شبابية تفاعلية حول تجهيز السيرة الذاتية وبناء المسار المهني لطلبة الهندسة.",
          location: "الجامعة الإسلامية بغزة – مبنى فلسطين",
          startsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10),
          capacity: 120,
          formUrl: "https://forms.google.com/",
          status: ActivityStatus.PUBLISHED,
        },
      });
      await tx.activity.create({
        data: {
          title: "Embedded Systems Lab Day",
          description: "تجربة عملية سريعة على المتحكمات الدقيقة والحساسات وبروتوكولات الاتصال.",
          location: "مختبرات كلية الهندسة",
          startsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 18),
          capacity: 60,
          formUrl: "https://forms.google.com/",
          status: ActivityStatus.PUBLISHED,
          departments: computer
            ? {
                create: {
                  department: { connect: { id: computer.id } },
                },
              }
            : undefined,
        },
      });
      await tx.activity.create({
        data: {
          title: "اليوم الهندسي المفتوح",
          description: "نشاط سابق للتعريف بمشاريع الطلبة ومسارات التخصصات الهندسية.",
          location: "ساحة كلية الهندسة",
          startsAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
          capacity: 250,
          formUrl: "https://forms.google.com/",
          status: ActivityStatus.ARCHIVED,
        },
      });
    });
  }

  console.log("Seed complete.");
}

main().finally(() => prisma.$disconnect());
