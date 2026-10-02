import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { optionalStudentRegistrationFields } from "../lib/student-registration";

async function main() {
  assert.deepEqual(optionalStudentRegistrationFields({ studentNumber: "", departmentId: "" }), {
    studentNumber: null,
    departmentId: null,
  });
  assert.deepEqual(optionalStudentRegistrationFields({ studentNumber: " 123456789 ", departmentId: " dep-1 " }), {
    studentNumber: "123456789",
    departmentId: "dep-1",
  });
  assert.throws(() => optionalStudentRegistrationFields({ studentNumber: "12A45", departmentId: "" }));

  const form = await readFile(new URL("../components/RegisterForm.tsx", import.meta.url), "utf8");
  assert.match(form, /name="studentNumber"/);
  assert.match(form, /الرقم الجامعي[\s\S]{0,100}اختياري/);
  assert.match(form, /التخصص[\s\S]{0,100}اختياري/);
  assert.doesNotMatch(form, /name="departmentId"[\s\S]{0,80}required/);

  console.log("Optional student registration fields tests passed.");
}

void main();
