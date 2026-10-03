import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { registrationAccountLinkQuery } from "../lib/registration-account-links";

async function main() {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TABLE "User" (id text PRIMARY KEY, email text, role text, "emailVerifiedAt" timestamp);
      CREATE TABLE "ActivityFormSubmission" (id text PRIMARY KEY, "formId" text, "userId" text, "studentEmail" text, UNIQUE ("formId", "userId"));
      CREATE TABLE "Certificate" (id text PRIMARY KEY, "submissionId" text, "artifactPathname" text);
      INSERT INTO "User" VALUES
        ('verified', 'Student@example.com', 'STUDENT', NOW()),
        ('pending', 'pending@example.com', 'STUDENT', NULL),
        ('other', 'other@example.com', 'STUDENT', NOW()),
        ('member', 'member@example.com', 'MEMBER', NOW()),
        ('admin', 'admin@example.com', 'ADMIN', NOW()),
        ('ambiguous1', 'duplicate@example.com', 'STUDENT', NOW()),
        ('ambiguous2', 'DUPLICATE@example.com', 'STUDENT', NOW());
      INSERT INTO "ActivityFormSubmission" VALUES
        ('guest', 'form1', NULL, ' student@EXAMPLE.com '),
        ('pending', 'form1', NULL, 'pending@example.com'),
        ('owned', 'form2', 'other', 'student@example.com'),
        ('existing', 'form3', 'verified', 'student@example.com'),
        ('conflict', 'form3', NULL, 'student@example.com'),
        ('duplicate1', 'form4', NULL, 'student@example.com'),
        ('duplicate2', 'form4', NULL, 'student@example.com'),
        ('different', 'form5', NULL, 'different@example.com'),
        ('member', 'form6', NULL, 'member@example.com'),
        ('admin', 'form7', NULL, 'admin@example.com'),
        ('ambiguous', 'form8', NULL, 'duplicate@example.com');
      INSERT INTO "Certificate" VALUES ('issued', 'guest', 'existing-certificate.png');
    `);
    const visibleCertificates = () => db.query(`SELECT c.id FROM "Certificate" c JOIN "ActivityFormSubmission" s ON s.id = c."submissionId" WHERE s."userId" = 'verified'`);
    assert.equal((await visibleCertificates()).rows.length, 0);
    const query = registrationAccountLinkQuery("verified");
    await db.query(query.text, query.values);
    const owners = async () => Object.fromEntries((await db.query<{id:string;userId:string|null}>(`SELECT id, "userId" FROM "ActivityFormSubmission"`)).rows.map(row=>[row.id,row.userId]));
    let result = await owners();
    assert.equal(result.guest, "verified", "Guest registrations must appear under the verified matching account");
    assert.equal((await visibleCertificates()).rows.length, 1, "Already issued certificates must become visible without reissuing them");
    assert.equal(result.owned, "other", "Existing ownership must never be reassigned");
    for (const id of ["pending", "conflict", "duplicate1", "duplicate2", "different", "member", "admin", "ambiguous"]) assert.equal(result[id], null, id);
    await db.query(query.text, query.values);
    assert.deepEqual(await owners(), result, "Linking must be idempotent");
    const pendingQuery = registrationAccountLinkQuery("pending");
    await db.query(pendingQuery.text, pendingQuery.values);
    assert.equal((await owners()).pending, null, "Unverified accounts cannot claim registrations");
    await db.exec(await readFile(new URL("../prisma/migrations/20261003160000_link_guest_activity_registrations/migration.sql", import.meta.url), "utf8"));
    result = await owners();
    assert.equal(result.member, "member");
    for (const id of ["pending", "conflict", "duplicate1", "duplicate2", "different", "admin", "ambiguous"]) assert.equal(result[id], null, id);
    await db.exec(`UPDATE "User" SET "emailVerifiedAt" = NOW() WHERE id = 'pending'`);
    await db.query(pendingQuery.text, pendingQuery.values);
    assert.equal((await owners()).pending, "pending", "Registrations must link after email verification");
    console.log("Registration account linking tests passed.");
  } finally { await db.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
