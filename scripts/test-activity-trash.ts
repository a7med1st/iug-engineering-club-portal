import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import type { PrismaClient } from "@prisma/client";
import { PGlite } from "@electric-sql/pglite";
import { moveActivityToTrash, restoreTrashedActivity } from "../lib/activity-trash";

async function main() {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TYPE "ActivityStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
      CREATE TABLE "Activity" (id TEXT PRIMARY KEY, status "ActivityStatus", "coverImageUrl" TEXT);
      CREATE TABLE "Submission" (id TEXT PRIMARY KEY, "activityId" TEXT REFERENCES "Activity"(id) ON DELETE CASCADE);
      INSERT INTO "Activity" VALUES ('published', 'PUBLISHED', '/cover.png'), ('draft', 'DRAFT', NULL), ('archived', 'ARCHIVED', NULL);
      INSERT INTO "Submission" VALUES ('student', 'published');
    `);
    await db.exec(await readFile("prisma/migrations/20261016120000_activity_recycle_bin/migration.sql", "utf8"));
    assert.equal((await db.query('SELECT * FROM "Activity" WHERE "deletedAt" IS NULL')).rows.length, 3);

    // Run the production lifecycle functions against an isolated PostgreSQL database.
    const adapter = { activity: { updateMany: async ({ where, data }: {
      where: Record<string, unknown>; data: Record<string, unknown>;
    }) => {
      const params: unknown[] = [];
      const bind = (value: unknown) => { params.push(value); return `$${params.length}`; };
      const assignments = Object.entries(data).map(([key, value]) => `"${key}" = ${bind(value)}`);
      const predicates = Object.entries(where).map(([key, value]) => {
        if (value === null) return `"${key}" IS NULL`;
        if (typeof value === "object") {
          assert.deepEqual(value, { not: null });
          return `"${key}" IS NOT NULL`;
        }
        return `"${key}" = ${bind(value)}`;
      });
      const result = await db.query(`UPDATE "Activity" SET ${assignments.join(", ")} WHERE ${predicates.join(" AND ")}`, params);
      return { count: result.affectedRows };
    } } } as unknown as Pick<PrismaClient, "activity">;

    for (const [id, status] of [["published", "PUBLISHED"], ["draft", "DRAFT"], ["archived", "ARCHIVED"]] as const) {
      assert.equal((await moveActivityToTrash(adapter, id, status)).count, 1);
      assert.equal((await moveActivityToTrash(adapter, id, "DRAFT")).count, 0);
      const deleted = (await db.query<{ status: string; statusBeforeDeletion: string }>('SELECT * FROM "Activity" WHERE id = $1', [id])).rows[0];
      assert.equal(deleted.status, "DRAFT");
      assert.equal(deleted.statusBeforeDeletion, status);
      assert.equal((await db.query('SELECT * FROM "Activity" WHERE id = $1 AND "deletedAt" IS NULL', [id])).rows.length, 0);
      assert.equal((await restoreTrashedActivity(adapter, id, status)).count, 1);
      assert.equal((await restoreTrashedActivity(adapter, id, status)).count, 0);
      const restored = (await db.query<{ status: string; deletedAt: null; statusBeforeDeletion: null }>('SELECT * FROM "Activity" WHERE id = $1', [id])).rows[0];
      assert.equal(restored.status, status);
      assert.equal(restored.deletedAt, null);
      assert.equal(restored.statusBeforeDeletion, null);
    }
    assert.equal((await moveActivityToTrash(adapter, "missing", "PUBLISHED")).count, 0);
    assert.equal((await db.query('SELECT * FROM "Submission"')).rows.length, 1);
    assert.equal((await db.query<{ coverImageUrl: string }>('SELECT "coverImageUrl" FROM "Activity" WHERE id = \'published\'')).rows[0].coverImageUrl, "/cover.png");
    console.log("Activity trash migration and lifecycle preserve status, images and registrations; repeated requests are safe.");
  } finally {
    await db.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
