import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { MAX_ACTIVITY_REGISTRATION_QUESTIONS } from "../lib/activity-registration-limits";
import { readQuestionCondition, validateQuestionConditions } from "../lib/registration-conditions";

// Exercise the action's actual parser without starting Next or connecting to a database.
const source = ts.createSourceFile("actions.ts", readFileSync(new URL("../app/admin/actions.ts", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
const declarations = source.statements.filter(statement =>
  (ts.isFunctionDeclaration(statement) && statement.name?.text === "parseRegistrationQuestions") ||
  (ts.isClassDeclaration(statement) && statement.name?.text === "AdminActionError") ||
  (ts.isVariableStatement(statement) && statement.declarationList.declarations.some(declaration => declaration.name.getText(source) === "activityQuestionTypes")),
);
assert.equal(declarations.length, 3);
const code = ts.transpileModule(declarations.map(statement => statement.getText(source)).join("\n") + "\nparseRegistrationQuestions;", { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const parse = vm.runInNewContext(code, { MAX_ACTIVITY_REGISTRATION_QUESTIONS, readQuestionCondition, validateQuestionConditions }) as (form: FormData) => { sortOrder: number; condition: unknown }[];

for (const count of [0, 50, 51, 100]) {
  const form = new FormData();
  form.set("registrationQuestions", JSON.stringify(Array.from({ length: count }, (_, index) => ({ label: `Question ${index + 1}`, type: "SHORT_TEXT", required: false }))));
  const result = parse(form);
  assert.equal(result.length, count);
  if (count) assert.equal(result[count - 1].sortOrder, count - 1);
}
const tooMany = new FormData();
tooMany.set("registrationQuestions", JSON.stringify(Array.from({ length: 101 }, (_, index) => ({ label: `Question ${index + 1}`, type: "SHORT_TEXT" }))));
assert.throws(() => parse(tooMany), /100/);

const conditional = Array.from({ length: 100 }, (_, index) => ({ label: `Question ${index + 1}`, type: index === 98 ? "SELECT" : "SHORT_TEXT", options: index === 98 ? ["yes", "no"] : [], condition: index === 99 ? { questionIndex: 98, value: "yes" } : null }));
const form = new FormData();
form.set("registrationQuestions", JSON.stringify(conditional));
assert.equal(JSON.stringify(parse(form)[99].condition), JSON.stringify({ questionIndex: 98, value: "yes" }));
console.log("Registration questions: 0, 50, 51 and 100 accepted; 101 rejected; conditions work on question 100.");
