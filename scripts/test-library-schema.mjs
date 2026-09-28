import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const schema = await readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8");

for (const model of ["LibraryCourse", "LibraryFolder", "LibraryFile"]) {
  assert.match(schema, new RegExp(`model ${model} \\{`));
}
assert.match(schema, /storageKey\s+String\s+@unique/);
assert.match(schema, /libraryCourses\s+LibraryCourse\[\]/);
assert.match(schema, /semester\s+Int\s+@default\(1\)/);
assert.match(schema, /createdLibraryFolders\s+LibraryFolder\[\]\s+@relation\("LibraryFolderCreator"\)/);
assert.match(schema, /uploadedLibraryFiles\s+LibraryFile\[\]\s+@relation\("LibraryFileUploader"\)/);

console.log("Library schema tests passed.");
