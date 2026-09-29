import assert from "node:assert/strict";
import { normalizeLibraryCourseCode } from "../lib/library/course-code";

for (const value of [" math 101 ", "MATH-101", "Math_101", "MATH\t101", "MATH\u00a0101"]) {
  assert.equal(normalizeLibraryCourseCode(value), "MATH101");
}
assert.equal(normalizeLibraryCourseCode(" ريض-١٠١ "), "ريض١٠١");
assert.equal(normalizeLibraryCourseCode("م.ع 101"), "م.ع101");
assert.equal(normalizeLibraryCourseCode(""), null);
assert.equal(normalizeLibraryCourseCode(" - _ \t"), null);
assert.equal(normalizeLibraryCourseCode(null), null);

console.log("Library course-code tests passed.");
