import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const schema = await readFile("prisma/schema.prisma", "utf8");
const migration = await readFile(
  "prisma/migrations/20260919090000_add_attendance_links_and_certificate_templates/migration.sql",
  "utf8",
).catch(() => "");
const individualFontMigration = await readFile(
  "prisma/migrations/20260927190000_certificate_individual_font_settings/migration.sql",
  "utf8",
);
const certificateActions = await readFile("app/admin/certificates/actions.ts", "utf8");
const individualEditor = await readFile("components/admin/IndividualCertificateEditor.tsx", "utf8");

assert.match(schema, /enum AttendanceSource[\s\S]*STAFF_QR[\s\S]*STAFF_MANUAL[\s\S]*SELF_LINK/);
assert.match(schema, /model ActivityAttendanceLink[\s\S]*tokenHash\s+String\s+@unique/);
assert.match(schema, /model CertificateTemplate[\s\S]*activityId\s+String\s+@unique/);
assert.match(schema, /attendanceLinkId\s+String\?/);
assert.match(schema, /artifactPathname\s+String\?/);
assert.match(schema, /nameFontFamily\s+String/);
assert.match(schema, /titleFontFamily\s+String/);
assert.match(schema, /dateFontFamily\s+String/);
assert.match(schema, /customNameFontSize\s+Decimal\?/);
assert.match(schema, /customNameBold\s+Boolean\?/);
assert.match(individualFontMigration, /ADD COLUMN "customNameFontSize"/);
assert.match(individualFontMigration, /ADD COLUMN "customNameBold"/);
assert.match(certificateActions, /customNameFontSize \?\? template\.nameFontSize/);
assert.match(certificateActions, /customNameBold \?\? template\.nameBold/);
assert.match(individualEditor, /name="customNameFontSize"/);
assert.match(individualEditor, /name="customNameBold"/);
assert.match(migration, /CREATE TABLE "ActivityAttendanceLink"/);
assert.match(migration, /CREATE TABLE "CertificateTemplate"/);
console.log("attendance/certificate schema contract passed");
