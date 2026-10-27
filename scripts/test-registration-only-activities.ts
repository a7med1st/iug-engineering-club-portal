import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { activityDateTimeFromInput } from "../lib/activities";
import { ActivitySessionsError, parseActivitySessions, validateSessionChanges } from "../lib/activity-sessions";
import { MAX_ACTIVITY_REGISTRATION_QUESTIONS } from "../lib/activity-registration-limits";
import { readQuestionCondition, validateQuestionConditions } from "../lib/registration-conditions";

const source = ts.createSourceFile("actions.ts", readFileSync(new URL("../app/admin/actions.ts", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
const functions = new Set(["requiredText", "parseRegistrationQuestions", "createActivity", "updateActivityText"]);
const variables = new Set(["activityStatuses", "activityQuestionTypes"]);
const declarations = source.statements.filter(statement =>
  (ts.isFunctionDeclaration(statement) && statement.name && functions.has(statement.name.text)) ||
  (ts.isClassDeclaration(statement) && statement.name?.text === "AdminActionError") ||
  (ts.isVariableStatement(statement) && statement.declarationList.declarations.some(declaration => variables.has(declaration.name.getText(source)))),
);
const code = ts.transpileModule(declarations.map(statement => statement.getText(source)).join("\n"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const creates: any[] = [];
const updates: any[] = [];
let sessionUpdates = 0;
const prisma = {
  department: { findMany: async () => [{ id: "department-1" }] },
  activity: {
    create: async ({ data }: any) => { creates.push(data); return { id: "activity-1" }; },
    findUnique: async () => ({ status: "PUBLISHED", registrationForm: { id: "form-1", questions: [] } }),
    update: async ({ data }: any) => { updates.push(data); },
  },
  activityDepartment: { deleteMany: async () => {} },
  activityRegistrationForm: { update: async () => {} },
  activityFormQuestion: { create: async () => {} },
  user: { findMany: async () => [] },
  $transaction: async (run: (tx: unknown) => unknown) => run(prisma),
};
const context = {
  exports: {}, prisma, MAX_ACTIVITY_REGISTRATION_QUESTIONS, readQuestionCondition, validateQuestionConditions,
  activityDateTimeFromInput, parseActivitySessions, validateSessionChanges, ActivitySessionsError,
  Prisma: { DbNull: null }, PERMISSIONS: { ACTIVITY_MANAGE: "ACTIVITY_MANAGE" },
  requirePermission: async () => ({ user: { role: "ADMIN" } }),
  requireActivityPermission: async () => ({ user: { role: "ADMIN" } }),
  revalidatePath: () => {},
  runAdminAction: async (_path: string, _success: string, _fallback: string, run: () => Promise<void>) => run(),
  updateActivitySessions: async () => { sessionUpdates++; },
};
vm.runInNewContext(code, context);
const actions = context.exports as { createActivity: (form: FormData) => Promise<{ success: boolean; message: string }>; updateActivityText: (form: FormData) => Promise<void> };
function form() {
  const data = new FormData();
  for (const [key, value] of Object.entries({ title: "Media committee", description: "Committee applications", capacity: "500", departmentIds: "all", status: "PUBLISHED", registrationOpenDate: "2026-10-01", registrationOpenTime: "09:00", registrationCloseDate: "2026-11-01", registrationCloseTime: "09:00", registrationFormIsOpen: "on" })) data.set(key, value);
  return data;
}

async function main() {
  const registrationOnly = form();
  registrationOnly.set("attendanceEnabled", "false");
  registrationOnly.set("registrationQuestions", JSON.stringify(Array.from({ length: 100 }, (_, index) => ({ label: `Question ${index + 1}`, type: "SHORT_TEXT" }))));
  const result = await actions.createActivity(registrationOnly);
  assert.equal(result.success, true, result.message);
  assert.equal(creates[0].attendanceEnabled, false);
  assert.equal(creates[0].location, "");
  assert.equal(creates[0].startsAt, null);
  assert.equal(creates[0].sessions.create.length, 0);
  assert.equal(creates[0].registrationForm.create.questions.create.length, 100);

  const workshop = form();
  workshop.set("location", "Room 1");
  const original = await actions.createActivity(workshop);
  assert.equal(original.success, true, original.message);
  assert.equal(creates[1].attendanceEnabled, true, "existing callers retain attendance by default");
  assert.equal(creates[1].sessions.create.length, 1);
  const missingLocation = await actions.createActivity(form());
  assert.equal(missingLocation.success, false, "attendance events still require a location");

  const edit = form();
  edit.set("activityId", "activity-1");
  edit.set("attendanceEnabled", "false");
  edit.set("activitySessions", "invalid disabled session data");
  await actions.updateActivityText(edit);
  assert.equal(updates[0].attendanceEnabled, false);
  assert.equal(sessionUpdates, 0, "switching to registration-only preserves existing sessions and attendance");
  edit.set("attendanceEnabled", "true");
  edit.set("location", "Room 1");
  edit.set("activitySessions", JSON.stringify({ sessions: [{ title: "Session 1" }], requiredAttendanceCount: 1 }));
  await actions.updateActivityText(edit);
  assert.equal(updates[1].attendanceEnabled, true);
  assert.equal(sessionUpdates, 1, "attendance mode can be restored");

  const attendanceSource = ts.createSourceFile("attendance-prisma.ts", readFileSync(new URL("../lib/attendance-prisma.ts", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
  const record = attendanceSource.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === "recordStaffSessionAttendance");
  assert.ok(record);
  const staffContext = {
    exports: {} as { recordStaffSessionAttendance: (input: unknown) => Promise<{ status: string }> },
    attendanceTransaction: async (run: (tx: unknown) => unknown) => run({ activityFormSubmission: {
      findFirst: async () => ({ status: "APPROVED", form: { activityId: "activity-1", activity: { attendanceEnabled: false } } }),
      update: async () => assert.fail("registration-only attendance must never be written"),
    } }),
  };
  vm.runInNewContext(ts.transpileModule(record.getText(attendanceSource), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, staffContext);
  for (const source of ["STAFF_QR", "STAFF_MANUAL"]) {
    const blocked = await staffContext.exports.recordStaffSessionAttendance({ activityId: "activity-1", submissionId: "submission-1", userId: "staff-1", source });
    assert.equal(blocked.status, "ERROR");
  }
  console.log("Registration-only creation, 100 saved questions, legacy defaults, optional location and mode conversion passed.");
}

void main();
