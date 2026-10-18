import assert from "node:assert/strict";
import { visibleQuestionIds, validateQuestionConditions } from "../lib/registration-conditions";

const questions = [
  { id: "major", type: "SELECT", options: ["architecture", "computer"], condition: null },
  { id: "design", type: "RADIO", options: ["yes", "no"], condition: { questionIndex: 0, value: "architecture" } },
  { id: "code", type: "SHORT_TEXT", options: [], condition: { questionIndex: 0, value: "computer" } },
  { id: "portfolio", type: "SHORT_TEXT", options: [], condition: { questionIndex: 1, value: "yes" } },
];
validateQuestionConditions(questions);
assert.deepEqual([...visibleQuestionIds(questions, {})], ["major"]);
assert.deepEqual([...visibleQuestionIds(questions, { major: "architecture", design: "yes" })], ["major", "design", "portfolio"]);
assert.deepEqual([...visibleQuestionIds(questions, { major: "computer", design: "yes" })], ["major", "code"]);
assert.deepEqual([...visibleQuestionIds(questions, { major: ["architecture"] })], ["major", "design"]);
assert.throws(() => validateQuestionConditions([{ ...questions[0], condition: { questionIndex: 0, value: "architecture" } }]));
assert.throws(() => validateQuestionConditions([questions[0], { ...questions[1], condition: { questionIndex: 0, value: "removed" } }]));
console.log("Registration condition tests passed");
