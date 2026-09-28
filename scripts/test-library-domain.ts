import assert from "node:assert/strict";
import { validateLibraryCourseInput, validateLibraryFolderInput, validateLibraryFileTitle, validateLibraryLinkInput } from "../lib/library/validation";

assert.deepEqual(validateLibraryCourseInput({ level: "1", name: "  قواعد البيانات ", code: " CPE331 ", description: "  وصف ", sortOrder: "2" }), {
  level: 1, semester: 1, name: "قواعد البيانات", code: "CPE331", description: "وصف", sortOrder: 2,
});
assert.equal(validateLibraryCourseInput({ level: "2", semester: "2", name: "مساق" }).semester, 2);
for (const semester of ["0", "3", "x"]) assert.throws(() => validateLibraryCourseInput({ level: "1", semester, name: "مساق" }));
for (const level of ["0", "6", "x"]) assert.throws(() => validateLibraryCourseInput({ level, name: "مساق", sortOrder: "0" }));
assert.throws(() => validateLibraryCourseInput({ level: "1", name: " ", sortOrder: "0" }));
assert.deepEqual(validateLibraryFolderInput({ name: " ملخصات ", sortOrder: "3", isVisible: "on" }), { name: "ملخصات", sortOrder: 3, isVisible: true });
assert.equal(validateLibraryFileTitle("  Final 2025  "), "Final 2025");
assert.throws(() => validateLibraryFileTitle(""));
assert.deepEqual(validateLibraryLinkInput({ title: " محاضرة 1 ", url: "https://example.com/lecture" }), { title: "محاضرة 1", url: "https://example.com/lecture" });
for (const url of ["javascript:alert(1)", "ftp://example.com/file", "https://user:pass@example.com", "not-a-url"]) {
  assert.throws(() => validateLibraryLinkInput({ title: "محاضرة", url }));
}
console.log("Library domain tests passed.");
