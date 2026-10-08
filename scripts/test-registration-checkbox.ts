import assert from "node:assert/strict";
import { checkboxAnswer } from "../lib/registration-checkbox";

const options = ["AI", "Web", "Embedded"];
const formData = new FormData();
formData.append("question_interests", "AI");
formData.append("question_interests", "Web");
assert.deepEqual(checkboxAnswer(formData.getAll("question_interests"), options, true), ["AI", "Web"]);
assert.deepEqual(checkboxAnswer(["AI", "Web"], options, true), ["AI", "Web"]);
assert.deepEqual(checkboxAnswer(["Web"], options, true), ["Web"]);
assert.equal(checkboxAnswer([], options, false), null);
assert.throws(() => checkboxAnswer([], options, true));
assert.throws(() => checkboxAnswer(["AI", "Unknown"], options, false));
assert.throws(() => checkboxAnswer(["AI", "AI"], options, false));
assert.throws(() => checkboxAnswer([new File(["AI"], "answer.txt")], options, false));
console.log("Checkbox answer validation passed.");
