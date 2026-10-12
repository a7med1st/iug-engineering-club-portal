import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

const url = new URL(process.env.DATABASE_URL ?? "");
if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.port !== "5433" || url.pathname !== "/engineering_club") {
  throw new Error("Member preview seeding is restricted to the local preview database.");
}
const prisma = new PrismaClient();
try {
  const roles = ["Club President", "Engineering Faculty Student Coordinator", "Vice President of the Club", "Administrative Committee Member"];
  const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 12);
  for (const [index, title] of roles.entries()) {
    const id = `design-preview-member-${index + 1}`;
    const name = `Preview Member ${index + 1}`;
    await prisma.user.upsert({
      where: { id },
      update: {},
      create: {
        id, name, email: `member-${index + 1}@preview.invalid`, passwordHash,
        role: "MEMBER", position: title,
        profileBio: "This is a sample member for the local design preview. As an engineering student, I enjoy building useful software, exploring emerging technologies, and collaborating with the engineering community. My work in the club focuses on supporting students, organizing activities, and turning shared ideas into practical projects.",
        profileSkills: ["Software Development", "Teamwork", "Leadership"],
        structureItem: { create: { name, title, sortOrder: index } },
      },
    });
  }
  console.log("Four local sample members are ready.");
} finally {
  await prisma.$disconnect();
}
