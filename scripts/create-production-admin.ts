import { readFile } from "node:fs/promises";

import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";

import { prisma } from "../lib/prisma";

function emailArgument() {
  const index = process.argv.indexOf("--email");
  const value = index >= 0 ? process.argv[index + 1]?.trim().toLowerCase() : "";
  if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new Error("A valid --email value is required.");
  }
  return value;
}

async function main() {
  const email = emailArgument();
  const password = (await readFile(0, "utf8")).replace(/[\r\n]+$/, "");
  if (password.length < 12) {
    throw new Error("The admin password must contain at least 12 characters.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        email,
        name: "مدير النادي الهندسي",
        passwordHash,
        role: Role.ADMIN,
        emailVerifiedAt: new Date(),
        mustChangePassword: true,
        sessionVersion: { increment: 1 },
      },
    });
    console.log("Production admin updated successfully.");
    return;
  }

  await prisma.user.create({
    data: {
      email,
      name: "مدير النادي الهندسي",
      passwordHash,
      role: Role.ADMIN,
      emailVerifiedAt: new Date(),
      mustChangePassword: true,
    },
  });
  console.log("Production admin created successfully.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Admin creation failed.");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
