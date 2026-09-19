import assert from "node:assert/strict";
import {
  createAttendanceToken,
  getAttendanceLinkState,
  hashAttendanceToken,
  validateAttendanceWindow,
} from "../lib/attendance-links";

const created = createAttendanceToken();
assert.match(created.token, /^[A-Za-z0-9_-]{43}$/);
assert.match(created.tokenHash, /^[a-f0-9]{64}$/);
assert.equal(created.tokenHash, hashAttendanceToken(created.token));
assert.equal(created.tokenPrefix, created.token.slice(0, 8));
assert.notEqual(created.tokenHash, hashAttendanceToken(`${created.token}x`));

const now = new Date("2026-09-19T12:00:00.000Z");
assert.equal(getAttendanceLinkState({ isActive: false, opensAt: null, closesAt: null }, now), "DISABLED");
assert.equal(getAttendanceLinkState({ isActive: true, opensAt: new Date("2026-09-19T12:00:01Z"), closesAt: null }, now), "NOT_OPEN");
assert.equal(getAttendanceLinkState({ isActive: true, opensAt: null, closesAt: new Date("2026-09-19T11:59:59Z") }, now), "EXPIRED");
assert.equal(getAttendanceLinkState({ isActive: true, opensAt: now, closesAt: now }, now), "ACTIVE");
assert.equal(getAttendanceLinkState({ isActive: true, opensAt: null, closesAt: null }, now), "ACTIVE");
assert.equal(validateAttendanceWindow(now, new Date(now.getTime() + 1_000)), null);
assert.match(validateAttendanceWindow(now, now) ?? "", /بعد/);
assert.match(validateAttendanceWindow(now, new Date(now.getTime() - 1_000)) ?? "", /بعد/);

console.log("attendance link domain tests passed");
