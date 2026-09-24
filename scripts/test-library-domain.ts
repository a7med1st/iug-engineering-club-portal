import assert from "node:assert/strict";
import { validateLibraryCourseInput, validateLibraryFolderInput, validateLibraryFileTitle } from "../lib/library/validation";

assert.deepEqual(validateLibraryCourseInput({ level: "1", name: "  قواعد البيانات ", code: " CPE331 ", description: "  وصف ", sortOrder: "2" }), {
  level: 1, name: "قواعد البيانات", code: "CPE331", description: "وصف", sortOrder: 2,
});
for (const level of ["0", "6", "x"]) assert.throws(() => validateLibraryCourseInput({ level, name: "مساق", sortOrder: "0" }));
assert.throws(() => validateLibraryCourseInput({ level: "1", name: " ", sortOrder: "0" }));
assert.deepEqual(validateLibraryFolderInput({ name: " ملخصات ", sortOrder: "3", isVisible: "on" }), { name: "ملخصات", sortOrder: 3, isVisible: true });
assert.equal(validateLibraryFileTitle("  Final 2025  "), "Final 2025");
assert.throws(() => validateLibraryFileTitle(""));
console.log("Library domain tests passed.");
