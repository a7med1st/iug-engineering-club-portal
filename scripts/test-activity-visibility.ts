import assert from "node:assert/strict";
import { currentActivityWhere, pastActivityWhere, isPastActivity } from "../lib/activities";

const referenceTime = new Date("2026-10-11T09:00:00.000Z");
const finished = { startsAt: new Date("2026-10-10T09:00:00Z"), endsAt: new Date("2026-10-10T11:00:00Z") };
const upcoming = { startsAt: new Date("2026-10-12T09:00:00Z"), endsAt: null };
assert.equal(isPastActivity({ ...finished, sessions: [finished, upcoming, { startsAt: null, endsAt: null }] }, referenceTime), false);
assert.equal(isPastActivity({ ...finished, sessions: [finished, finished] }, referenceTime), true);
assert.equal(isPastActivity({ ...finished, sessions: [{ startsAt: referenceTime, endsAt: null }] }, referenceTime), true);
assert.equal(isPastActivity({ ...finished, sessions: [] }, referenceTime), true);
assert.equal(isPastActivity(upcoming, referenceTime), false);

assert.equal(isPastActivity({ ...finished, sessions: [{ startsAt: null, endsAt: null }] }, referenceTime), true);
assert.equal(isPastActivity({ ...finished, sessions: [finished, { startsAt: null, endsAt: null }] }, referenceTime), true);
assert.equal(isPastActivity({ ...upcoming, sessions: [{ startsAt: null, endsAt: null }] }, referenceTime), false);
assert.equal(isPastActivity({ startsAt: null, endsAt: null, sessions: [{ startsAt: null, endsAt: null }] }, referenceTime), false);
assert.equal(isPastActivity({ startsAt: referenceTime, endsAt: referenceTime }, referenceTime), true);
assert.equal(currentActivityWhere(referenceTime).status, "PUBLISHED");
assert.equal(pastActivityWhere(referenceTime).status, "PUBLISHED");
console.log("Activity visibility respects session schedules, inherited dates, and exact end times");

// Exercise both query filters against a matrix of nullable schedules.
function matches(row: any, where: any): boolean {
  return Object.entries(where).every(([key, value]: [string, any]) => {
    if (key === "OR") return value.some((clause: any) => matches(row, clause));
    if (key === "sessions") return Object.entries(value).every(([op, clause]) =>
      op === "some" ? row.sessions.some((session: any) => matches(session, clause)) :
      op === "every" ? row.sessions.every((session: any) => matches(session, clause)) :
      !row.sessions.some((session: any) => matches(session, clause)));
    if (value === null || typeof value !== "object") return row[key] === value;
    if (row[key] === null) return false;
    return Object.entries(value).every(([op, date]: [string, any]) =>
      op === "lte" ? row[key] <= date : row[key] > date);
  });
}
const schedules = [finished, upcoming, { startsAt: null, endsAt: null },
  { startsAt: referenceTime, endsAt: null },
  { startsAt: finished.startsAt, endsAt: upcoming.startsAt },
  { startsAt: null, endsAt: finished.endsAt }];
for (const schedule of schedules) {
  for (const sessions of [[], ...schedules.map((session) => [session]), ...schedules.map((session) => [finished, session])]) {
    const activity = { ...schedule, sessions, status: "PUBLISHED", attendanceEnabled: true };
    const past = isPastActivity(activity, referenceTime);
    assert.equal(matches(activity, pastActivityWhere(referenceTime)), past);
    assert.equal(matches(activity, currentActivityWhere(referenceTime)), !past);
    const registrationOnly = { ...activity, attendanceEnabled: false };
    assert.equal(isPastActivity(registrationOnly, referenceTime), false);
    assert.equal(matches(registrationOnly, pastActivityWhere(referenceTime)), false);
    assert.equal(matches(registrationOnly, currentActivityWhere(referenceTime)), true);
  }
}
console.log("Current and past database filters agree across 78 schedule combinations");
