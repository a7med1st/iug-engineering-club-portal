import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

async function main() {
const schema = await readFile("prisma/schema.prisma", "utf8");
assert.match(schema, /model ActivitySession\s*\{/);
assert.match(schema, /model ActivitySessionAttendance\s*\{/);
assert.match(schema, /@@unique\(\[sessionId, submissionId\]\)/);

const db = new PGlite();
try {
  await db.exec(`
    CREATE TYPE "AttendanceSource" AS ENUM ('STAFF_QR', 'STAFF_MANUAL', 'SELF_LINK');
    CREATE TABLE "Activity" (id TEXT PRIMARY KEY, "startsAt" TIMESTAMP(3), "endsAt" TIMESTAMP(3));
    CREATE TABLE "ActivityRegistrationForm" (id TEXT PRIMARY KEY, "activityId" TEXT NOT NULL REFERENCES "Activity"(id));
    CREATE TABLE "ActivityAttendanceLink" (id TEXT PRIMARY KEY, "activityId" TEXT NOT NULL REFERENCES "Activity"(id));
    CREATE UNIQUE INDEX "ActivityAttendanceLink_activityId_key" ON "ActivityAttendanceLink"("activityId");
    CREATE TABLE "ActivityFormSubmission" (id TEXT PRIMARY KEY, "formId" TEXT REFERENCES "ActivityRegistrationForm"(id),
      "checkedInAt" TIMESTAMP(3), "checkedInById" TEXT, "attendanceSource" "AttendanceSource", "attendanceLinkId" TEXT);
    INSERT INTO "Activity" VALUES ('old', '2026-10-01 10:00:00', NULL), ('empty', NULL, NULL);
    INSERT INTO "ActivityRegistrationForm" VALUES ('form', 'old');
    INSERT INTO "ActivityAttendanceLink" VALUES ('link', 'old');
    INSERT INTO "ActivityFormSubmission" VALUES
      ('present', 'form', '2026-10-01 10:20:00', 'staff', 'STAFF_QR', 'link'),
      ('absent', 'form', NULL, NULL, NULL, NULL);
  `);
  const migration = await readFile("prisma/migrations/20261010120000_add_activity_sessions_and_attendance/migration.sql", "utf8");
  await db.exec(migration);
  const sessions = await db.query<{ id: string; activityId: string; title: string }>('SELECT * FROM "ActivitySession" ORDER BY "activityId"');
  assert.equal(sessions.rows.length, 2);
  const main = sessions.rows.find(row => row.activityId === "old")!;
  const attendances = await db.query<{ sessionId: string; submissionId: string; checkedInById: string; attendanceSource: string }>('SELECT * FROM "ActivitySessionAttendance"');
  assert.equal(attendances.rows.length, 1);
  assert.equal(attendances.rows[0].sessionId, main.id);
  assert.equal(attendances.rows[0].submissionId, "present");
  assert.equal(attendances.rows[0].checkedInById, "staff");
  assert.equal(attendances.rows[0].attendanceSource, "STAFF_QR");
  assert.equal((await db.query<{ sessionId: string }>('SELECT "sessionId" FROM "ActivityAttendanceLink"')).rows[0].sessionId, main.id);
  assert.equal((await db.query('SELECT * FROM "ActivityFormSubmission" WHERE "checkedInAt" IS NOT NULL')).rows.length, 1);
  await assert.rejects(db.exec(`INSERT INTO "ActivitySessionAttendance" (id,"sessionId","submissionId","checkedInAt","attendanceSource","updatedAt") VALUES ('duplicate','${main.id}','present',NOW(),'SELF_LINK',NOW())`), /unique/i);
  await db.exec(`INSERT INTO "ActivitySession" (id,"activityId",title,"sortOrder","updatedAt") VALUES ('second','old','Workshop 2',1,NOW());
    INSERT INTO "ActivityAttendanceLink" VALUES ('link2','old','second');
    INSERT INTO "ActivitySessionAttendance" (id,"sessionId","submissionId","checkedInAt","attendanceSource","updatedAt") VALUES ('attend2','second','present',NOW(),'SELF_LINK',NOW());`);
  assert.equal((await db.query('SELECT * FROM "ActivitySessionAttendance" WHERE "submissionId" = \'present\'')).rows.length, 2);
  console.log("Activity sessions migration preserves legacy data and enforces independent unique attendance.");
} finally {
  await db.close();
}
}
main().catch(error => { console.error(error); process.exitCode = 1; });
