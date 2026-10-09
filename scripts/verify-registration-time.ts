import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";
import ExcelJS from "exceljs";
import { formatActivityTimestamp } from "../lib/activities";

const prisma = new PrismaClient();
async function main() {
  const [clock] = await prisma.$queryRaw<Array<{ timezone: string; clock: Date }>>`
    SELECT current_setting('TimeZone') AS timezone, CURRENT_TIMESTAMP AS clock
  `;
  assert.ok(Math.abs(clock.clock.getTime() - Date.now()) < 30000, "Database and application clocks differ");
  console.log(`Registration clock verification: database zone ${clock.timezone}, database and application clocks agree.`);
  const submission = await prisma.activityFormSubmission.findFirst({
    orderBy: { submittedAt: "desc" },
    select: { submittedAt: true, form: { select: { activityId: true } } },
  });
  if (!submission) { console.log("No registration timestamps to verify."); return; }
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true, name: true, email: true, sessionVersion: true } });
  assert.ok(admin && process.env.SESSION_SECRET, "HTTP verification requires an admin and session configuration");
  const token = await new SignJWT({ name: admin.name, email: admin.email, role: "ADMIN", sessionVersion: admin.sessionVersion })
    .setProtectedHeader({ alg: "HS256" }).setSubject(admin.id)
    .setIssuer("iug-engineering-club-portal").setAudience("iug-engineering-club-web")
    .setIssuedAt().setExpirationTime("5m").sign(new TextEncoder().encode(process.env.SESSION_SECRET));
  const options = { headers: { cookie: `ec_session=${token}` }, redirect: "manual" as const, signal: AbortSignal.timeout(30000) };
  const url = `http://127.0.0.1:3000/admin/activities/${submission.form.activityId}/registrations`;
  const expected = formatActivityTimestamp(submission.submittedAt);
  const page = await fetch(url, options);
  assert.equal(page.status, 200);
  assert.ok((await page.text()).includes(expected), "Registration page does not show Palestinian local time");
  const exported = await fetch(`${url}/export`, options);
  assert.equal(exported.status, 200);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await exported.arrayBuffer());
  let found = false;
  for (const sheet of workbook.worksheets) sheet.eachRow((row) => row.eachCell((cell) => { if (cell.text === expected) found = true; }));
  assert.ok(found, "Registration export does not show the same Palestinian local time");
  console.log("Registration timestamp verification passed: live registration page and Excel export agree in Palestinian time.");
}
main().finally(() => prisma.$disconnect()).catch((error) => {
  console.error(`Registration timestamp verification failed: ${error instanceof Error ? error.name : "UnknownError"}`);
  process.exitCode = 1;
});
