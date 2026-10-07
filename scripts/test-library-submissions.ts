import assert from "node:assert/strict";
import { validateLibrarySubmissionTitle, canReviewLibrarySubmission } from "../lib/library/submissions";

assert.equal(validateLibrarySubmissionTitle("  ملخص دوائر  "), "ملخص دوائر");
assert.throws(() => validateLibrarySubmissionTitle(" "));
assert.throws(() => validateLibrarySubmissionTitle("x".repeat(121)));
assert.equal(canReviewLibrarySubmission("PENDING", "department-a", "department-a"), true);
assert.equal(canReviewLibrarySubmission("PENDING", "department-a", "department-b"), false);
assert.equal(canReviewLibrarySubmission("APPROVED", "department-a", "department-a"), false);
console.log("Library submission policy passed");
