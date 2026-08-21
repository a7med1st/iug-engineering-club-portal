import path from "node:path";
import { prisma } from "../lib/prisma";

const imageMap: Record<string, string> = {
  "ai.png": "/images/departments/ai-profile.png",
  "architecture.png": "/images/departments/architecture-profile.png",
  "civil.png": "/images/departments/civil-profile.png",
  "computer.png": "/images/departments/computer-profile.png",
  "electrical.png": "/images/departments/electrical-profile.png",
  "industrial.png": "/images/departments/industrial-profile.png",
  "mechanical.png": "/images/departments/mechanical-profile.png",
  "intelligent-systems.png": "/images/departments/smart-systems-profile.png",
};

async function main() {
  const departments = await prisma.department.findMany({
    select: {
      id: true,
      nameAr: true,
      nameEn: true,
      slug: true,
      coverImage: true,
      detailImage: true,
    },
    orderBy: {
      sortOrder: "asc",
    },
  });

  console.log(`Found ${departments.length} departments.\n`);

  for (const department of departments) {
    const currentFileName = path.basename(
      department.coverImage.replace(/\\/g, "/")
    );

    const detailImage = imageMap[currentFileName];

    if (!detailImage) {
      console.warn(
        `SKIPPED: ${department.nameEn} | coverImage=${department.coverImage}`
      );
      continue;
    }

    await prisma.department.update({
      where: {
        id: department.id,
      },
      data: {
        detailImage,
      },
    });

    console.log(
      `UPDATED: ${department.nameEn} -> ${detailImage}`
    );
  }

  console.log("\nDepartment detail images updated successfully.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });