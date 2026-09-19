import assert from "node:assert/strict";
import {
  confirmAttendance,
  loadAttendanceConfirmation,
  type AttendanceConfirmationDeps,
} from "../lib/attendance-confirmation";
import { hashAttendanceToken } from "../lib/attendance-links";

const now = new Date("2026-09-19T12:00:00.000Z");

function deps(
  overrides: Partial<AttendanceConfirmationDeps> & {
    link?: Partial<Awaited<ReturnType<AttendanceConfirmationDeps["findLink"]>>>;
    submission?: Partial<NonNullable<Awaited<ReturnType<AttendanceConfirmationDeps["findSubmission"]>>>> | null;
  } = {},
): AttendanceConfirmationDeps {
  const link = overrides.link === null ? null : {
    id: "link-1",
    activityId: "activity-1",
    isActive: true,
    opensAt: null,
    closesAt: null,
    activity: { id: "activity-1", title: "دورة آمنة", startsAt: now },
    ...overrides.link,
  };
  const submission = overrides.submission === null ? null : {
    id: "submission-1",
    status: "APPROVED" as const,
    checkedInAt: null,
    studentName: "طالب الاختبار",
    ...overrides.submission,
  };
  return {
    now: () => now,
    findLink: async ({ activityId, tokenHash }) =>
      link && link.activityId === activityId && tokenHash === hashAttendanceToken("valid-token") ? link : null,
    findSubmission: async () => submission,
    recordAttendance: async () => 1,
    consumeRateLimit: async () => true,
    ...overrides,
  };
}

async function main() {
assert.deepEqual(
  await loadAttendanceConfirmation(
    { activityId: "activity-1", token: "wrong", user: null },
    deps(),
  ),
  { status: "INVALID_LINK" },
);

assert.equal(
  (await loadAttendanceConfirmation(
    { activityId: "activity-2", token: "valid-token", user: null },
    deps(),
  )).status,
  "INVALID_LINK",
);

for (const [link, expected] of [
  [{ isActive: false }, "LINK_DISABLED"],
  [{ opensAt: new Date(now.getTime() + 1) }, "NOT_OPEN"],
  [{ closesAt: new Date(now.getTime() - 1) }, "EXPIRED"],
] as const) {
  assert.equal(
    (await loadAttendanceConfirmation(
      { activityId: "activity-1", token: "valid-token", user: null },
      deps({ link }),
    )).status,
    expected,
  );
}

assert.equal((await loadAttendanceConfirmation({ activityId: "activity-1", token: "valid-token", user: null }, deps())).status, "LOGIN_REQUIRED");
assert.equal((await loadAttendanceConfirmation({ activityId: "activity-1", token: "valid-token", user: { id: "admin", role: "ADMIN", name: "Admin" } }, deps())).status, "WRONG_ROLE");
assert.equal((await loadAttendanceConfirmation({ activityId: "activity-1", token: "valid-token", user: { id: "student", role: "STUDENT", name: "Student" } }, deps({ submission: null }))).status, "NOT_REGISTERED");
assert.equal((await loadAttendanceConfirmation({ activityId: "activity-1", token: "valid-token", user: { id: "student", role: "STUDENT", name: "Student" } }, deps({ submission: { status: "SUBMITTED" } }))).status, "PENDING_REGISTRATION");
assert.equal((await loadAttendanceConfirmation({ activityId: "activity-1", token: "valid-token", user: { id: "student", role: "STUDENT", name: "Student" } }, deps({ submission: { status: "REJECTED" } }))).status, "REJECTED_REGISTRATION");
assert.equal((await loadAttendanceConfirmation({ activityId: "activity-1", token: "valid-token", user: { id: "student", role: "STUDENT", name: "Student" } }, deps({ submission: { checkedInAt: now } }))).status, "ALREADY_RECORDED");
assert.equal((await loadAttendanceConfirmation({ activityId: "activity-1", token: "valid-token", user: { id: "student", role: "STUDENT", name: "Student" } }, deps())).status, "READY");

const writes: Array<Record<string, unknown>> = [];
const success = await confirmAttendance(
  { activityId: "activity-1", token: "valid-token", userId: "student", role: "STUDENT" },
  deps({ recordAttendance: async (input) => { writes.push(input); return 1; } }),
);
assert.equal(success.ok, true);
assert.equal(writes[0]?.attendanceSource, "SELF_LINK");
assert.equal(writes[0]?.attendanceLinkId, "link-1");
assert.equal(writes[0]?.checkedInById, null);

const expiredAtSubmit = await confirmAttendance(
  { activityId: "activity-1", token: "valid-token", userId: "student", role: "STUDENT" },
  deps({ link: { closesAt: new Date(now.getTime() - 1) } }),
);
assert.deepEqual(expiredAtSubmit, { ok: false, code: "EXPIRED" });

const blocked = await confirmAttendance(
  { activityId: "activity-1", token: "valid-token", userId: "student", role: "STUDENT" },
  deps({ consumeRateLimit: async () => false }),
);
assert.deepEqual(blocked, { ok: false, code: "RATE_LIMITED" });

const race = await confirmAttendance(
  { activityId: "activity-1", token: "valid-token", userId: "student", role: "STUDENT" },
  deps({ recordAttendance: async () => 0, findSubmission: async () => ({ id: "submission-1", status: "APPROVED", checkedInAt: now, studentName: "Student" }) }),
);
assert.equal(race.ok && race.alreadyRecorded, true);

console.log("attendance confirmation tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
