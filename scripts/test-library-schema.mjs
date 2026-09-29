import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const schema = await readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
const nestedFoldersMigration = await readFile(
  new URL("../prisma/migrations/20260929000000_add_nested_library_folders/migration.sql", import.meta.url),
  "utf8",
).catch(() => "");

for (const model of ["LibraryCourse", "LibraryFolder", "LibraryFile"]) {
  assert.match(schema, new RegExp(`model ${model} \\{`));
}
assert.match(schema, /storageKey\s+String\s+@unique/);
assert.match(schema, /libraryCourses\s+LibraryCourse\[\]/);
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

console.log("Library schema tests passed.");
