import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const source = await readFile(new URL("../app/admin/library/actions.ts", import.meta.url), "utf8");
for (const name of ["createCourseAction", "updateCourseAction", "deleteCourseAction", "createFolderAction", "updateFolderAction", "deleteFolderAction", "updateFileTitleAction", "deleteFileAction"]) assert.match(source, new RegExp(`export async function ${name}`));
assert.match(source, /requireLibraryCourse/);
assert.match(source, /requireLibraryFolder/);
assert.match(source, /requireLibraryFile/);
assert.match(source, /deleteLibraryFiles/);
console.log("Library action contract tests passed.");
