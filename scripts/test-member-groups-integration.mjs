import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";

const url = new URL(process.env.DATABASE_URL ?? "");
assert.ok(["localhost", "127.0.0.1"].includes(url.hostname) && url.port === "5433", "Use the isolated local database");
const prisma = new PrismaClient();
const base = "http://localhost:3000";
const prefix = "group-test-" + randomUUID();
const groups = ["ADMINISTRATIVE", "PUBLIC_RELATIONS", "MEMBERS", "MEDIA"];
const labels = ["الهيئة الإدارية", "لجنة العلاقات العامة", "الأعضاء", "اللجنة الإعلامية"];
try {
  const admin = await prisma.user.create({ data: {
    id: prefix + "-admin", name: "Group Test Admin", email: prefix + "-admin@preview.invalid",
    passwordHash: "disabled-test-login", role: "ADMIN", emailVerifiedAt: new Date(),
  } });
  const token = await new SignJWT({ email: admin.email, name: admin.name, role: admin.role, sessionVersion: admin.sessionVersion })
    .setProtectedHeader({ alg: "HS256" }).setSubject(admin.id).setIssuer("iug-engineering-club-portal")
    .setAudience("iug-engineering-club-web").setIssuedAt().setExpirationTime("10m")
    .sign(new TextEncoder().encode(process.env.SESSION_SECRET));
  for (const [index, group] of groups.entries()) {
    await prisma.user.create({ data: {
      id: prefix + "-" + index, name: prefix + "-" + index, email: prefix + "-" + index + "@preview.invalid",
      passwordHash: "disabled-test-login", role: "MEMBER",
      structureItem: { create: { id: prefix + "-structure-" + index, name: prefix + "-" + index, title: "Test role", memberGroup: group } },
    } });
  }
  const listing = await fetch(base + "/members");
  assert.equal(listing.status, 200);
  const html = await listing.text();
  for (const [index, group] of groups.entries()) {
    const section = html.match(new RegExp('<section[^>]*aria-labelledby="group-' + group + '"[^>]*>([\\s\\S]*?)</section>'))?.[1];
    assert.ok(section?.includes(prefix + "-" + index), group + " must contain its member");
    const detail = await fetch(base + "/members/" + prefix + "-" + index);
    assert.equal(detail.status, 200);
    assert.ok((await detail.text()).includes(labels[index]));
  }
  const adminPage = await fetch(base + "/admin/structure", { headers: { cookie: "ec_session=" + token } });
  assert.equal(adminPage.status, 200);
  const adminHtml = await adminPage.text();
  const form = [...adminHtml.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)]
    .map((match) => match[1]).find((form) => form.includes('value="' + prefix + '-structure-0"') && form.includes('name="memberGroup"'));
  assert.ok(form, "Edit form must expose a member group");
  const action = form.match(/name="(\$ACTION_ID_[^"]+)"/)?.[1];
  assert.ok(action, "Server action must be present");
  const data = new FormData();
  for (const [key, value] of Object.entries({
    [action]: "", itemId: prefix + "-structure-0", userId: prefix + "-0",
    name: prefix + "-0", title: "Test role", memberGroup: "MEDIA", parentId: "",
  })) data.set(key, value);
  const update = await fetch(base + "/admin/structure", {
    method: "POST", headers: { cookie: "ec_session=" + token, origin: base }, body: data, redirect: "manual",
  });
  assert.equal(update.status, 303);
  assert.equal((await prisma.clubStructureItem.findUniqueOrThrow({ where: { id: prefix + "-structure-0" } })).memberGroup, "MEDIA");
  console.log("All groups render correctly; profile badges and admin category updates passed.");
} finally {
  await prisma.clubStructureItem.deleteMany({ where: { id: { startsWith: prefix } } });
  await prisma.user.deleteMany({ where: { id: { startsWith: prefix } } });
  await prisma.$disconnect();
}
