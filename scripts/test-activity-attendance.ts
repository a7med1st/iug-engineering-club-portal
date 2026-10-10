import assert from "node:assert/strict";
import { getAttendanceProgress } from "../lib/activity-attendance";

const legacy = { status: "APPROVED", checkedInAt: new Date() };
assert.deepEqual(getAttendanceProgress(legacy), { attendanceCount: 1, totalSessions: 0, requiredAttendanceCount: 1, eligible: true });
assert.equal(getAttendanceProgress({ ...legacy, checkedInAt: null }).eligible, false);
const workshop = {
  ...legacy,
  form: { activity: { sessions: [{ id: "a" }, { id: "b" }, { id: "c" }], requiredAttendanceCount: 2 } },
  sessionAttendances: [{ sessionId: "a" }, { sessionId: "a" }, { sessionId: "foreign" }],
};
assert.deepEqual(getAttendanceProgress(workshop), { attendanceCount: 1, totalSessions: 3, requiredAttendanceCount: 2, eligible: false });
assert.equal(getAttendanceProgress({ ...workshop, sessionAttendances: [] }).attendanceCount, 0);
const qualified = { ...workshop, checkedInAt: null, sessionAttendances: [{ sessionId: "a" }, { sessionId: "b" }] };
assert.equal(getAttendanceProgress(qualified).eligible, true);
for (const status of ["PENDING", "REJECTED", "CANCELLED"]) {
  assert.equal(getAttendanceProgress({ ...qualified, status }).eligible, false);
}
assert.equal(getAttendanceProgress({ ...qualified, form: { activity: { ...workshop.form.activity, requiredAttendanceCount: 4 } } }).eligible, false);
assert.equal(getAttendanceProgress({ ...legacy, form: { activity: { sessions: [], requiredAttendanceCount: 2 } } }).eligible, false);
assert.equal(getAttendanceProgress({ ...qualified, form: { activity: { sessions: workshop.form.activity.sessions } } }).requiredAttendanceCount, 1);
const before = structuredClone(workshop);
getAttendanceProgress(workshop);
assert.deepEqual(workshop, before, "progress calculation must not mutate its input");
console.log("activity attendance tests passed");
