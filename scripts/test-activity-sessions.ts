import assert from "node:assert/strict";
import { parseActivitySessions, validateSessionChanges } from "../lib/activity-sessions";

function data(value?: unknown) {
  const form = new FormData();
  if (value !== undefined) form.set("activitySessions", JSON.stringify(value));
  return form;
}
const session = { title: "الجلسة الرئيسية" };
assert.equal(parseActivitySessions(data()).sessions.length, 1);
assert.equal(parseActivitySessions(data({ sessions: Array.from({ length: 12 }, () => session), requiredAttendanceCount: 8 })).requiredAttendanceCount, 8);
for (const value of [null, [], { sessions: [] }, { sessions: [session], requiredAttendanceCount: 2 }, { sessions: [{ title: "" }] }, { sessions: [session], requiredAttendanceCount: 1.5 }, { sessions: [{ ...session, startDate: "2026-02-30", startTime: "12:00" }] }, { sessions: [{ ...session, startDate: "2026-10-10" }] }, { sessions: [{ ...session, endDate: "2026-10-10", endTime: "12:00" }] }, { sessions: [{ ...session, id: "a" }, { ...session, id: "a" }] }]) {
  assert.throws(() => parseActivitySessions(data(value)));
}
const config = parseActivitySessions(data({ sessions: [session], requiredAttendanceCount: 1 }));
assert.throws(() => validateSessionChanges(config, [{ id: "old", attendanceCount: 1 }]));
config.confirmedDeletedSessionIds = ["old"];
assert.deepEqual(validateSessionChanges(config, [{ id: "old", attendanceCount: 1 }]), ["old"]);
assert.throws(() => validateSessionChanges({ ...config, sessions: [{ ...config.sessions[0], id: "foreign" }] }, []));
assert.throws(() => validateSessionChanges({ ...config, confirmedDeletedSessionIds: ["foreign"] }, []));
assert.deepEqual(validateSessionChanges({ ...config, confirmedDeletedSessionIds: [] }, [{ id: "unattended", attendanceCount: 0 }]), ["unattended"]);
const malformed = new FormData(); malformed.set("activitySessions", "{");
assert.throws(() => parseActivitySessions(malformed));
const scheduled = parseActivitySessions(data({ sessions: [{ ...session, startDate: "2026-10-10", startTime: "12:00", endDate: "2026-10-10", endTime: "13:00" }] }));
assert.ok(scheduled.sessions[0].startsAt instanceof Date);
assert.ok(scheduled.sessions[0].endsAt! > scheduled.sessions[0].startsAt!);
assert.equal(scheduled.sessions[0].sortOrder, 0);
console.log("Activity sessions validation passed");
