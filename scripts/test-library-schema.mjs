import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const schema = await readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
const nestedFoldersMigration = await readFile(
  new URL("../prisma/migrations/20260929000000_add_nested_library_folders/migration.sql", import.meta.url),
  "utf8",
).catch(() => "");
const sharedCoursesMigration = await readFile(
  new URL("../prisma/migrations/20260929120000_share_library_courses_and_order_files/migration.sql", import.meta.url),
  "utf8",
).catch(() => "");

for (const model of ["LibraryCourse", "LibraryCourseDepartment", "LibraryFolder", "LibraryFile"]) {
  assert.match(schema, new RegExp(`model ${model} \\{`));
}
assert.match(schema, /storageKey\s+String\s+@unique/);
assert.match(schema, /libraryCourseDepartments\s+LibraryCourseDepartment\[\]/);
assert.match(schema, /semester\s+Int\s+@default\(1\)/);
assert.match(schema, /createdLibraryFolders\s+LibraryFolder\[\]\s+@relation\("LibraryFolderCreator"\)/);
assert.match(schema, /uploadedLibraryFiles\s+LibraryFile\[\]\s+@relation\("LibraryFileUploader"\)/);
assert.match(schema, /parentId\s+String\?/);
assert.match(schema, /parent\s+LibraryFolder\?\s+@relation\("LibraryFolderTree"[^\n]+onDelete: Cascade\)/);
assert.match(schema, /children\s+LibraryFolder\[\]\s+@relation\("LibraryFolderTree"\)/);
assert.match(schema, /@@index\(\[courseId, parentId, sortOrder\]\)/);
assert.match(nestedFoldersMigration, /ADD COLUMN\s+"parentId" TEXT/i);
assert.match(nestedFoldersMigration, /CREATE INDEX "LibraryFolder_courseId_parentId_sortOrder_idx"/);
assert.match(nestedFoldersMigration, /FOREIGN KEY \("parentId"\)[\s\S]*REFERENCES "LibraryFolder"\("id"\)[\s\S]*ON DELETE CASCADE/i);
assert.match(schema, /normalizedCode\s+String\?\s+@unique/);
assert.match(schema, /model LibraryCourseDepartment \{[\s\S]*courseId\s+String[\s\S]*departmentId\s+String[\s\S]*level\s+Int[\s\S]*semester\s+Int\s+@default\(1\)[\s\S]*sortOrder\s+Int\s+@default\(0\)[\s\S]*@@id\(\[courseId, departmentId\]\)[\s\S]*@@index\(\[departmentId, level, semester, sortOrder\]\)/);
assert.match(schema, /model LibraryFile \{[\s\S]*sortOrder\s+Int\s+@default\(0\)[\s\S]*@@index\(\[folderId, sortOrder, createdAt\]\)/);
assert.match(sharedCoursesMigration, /CREATE TABLE "LibraryCourseDepartment"/);
assert.match(sharedCoursesMigration, /INSERT INTO "LibraryCourseDepartment"[\s\S]*SELECT[\s\S]*"departmentId"[\s\S]*"level"[\s\S]*"semester"[\s\S]*"sortOrder"/i);
assert.match(sharedCoursesMigration, /ROW_NUMBER\(\) OVER \(PARTITION BY "folderId" ORDER BY "createdAt", "id"\)/i);
assert.match(sharedCoursesMigration, /UPDATE "LibraryFolder"[\s\S]*SET "courseId"/i);
assert.match(sharedCoursesMigration, /DELETE FROM "LibraryCourse"[\s\S]*canonical/i);
assert.match(sharedCoursesMigration, /DROP COLUMN "departmentId"[\s\S]*DROP COLUMN "level"[\s\S]*DROP COLUMN "semester"[\s\S]*DROP COLUMN "sortOrder"/i);

console.log("Library schema tests passed.");
