import assert from "node:assert/strict";
import { currentActivityWhere, pastActivityWhere, isPastActivity } from "../lib/activities";

const referenceTime = new Date("2026-10-11T09:00:00.000Z");
const finished = { startsAt: new Date("2026-10-10T09:00:00Z"), endsAt: new Date("2026-10-10T11:00:00Z") };
const upcoming = { startsAt: new Date("2026-10-12T09:00:00Z"), endsAt: null };
assert.equal(isPastActivity({ ...finished, sessions: [finished, upcoming, { startsAt: null, endsAt: null }] }, referenceTime), false);
assert.equal(isPastActivity({ ...finished, sessions: [finished, finished] }, referenceTime), true);
assert.equal(isPastActivity({ ...finished, sessions: [{ startsAt: null, endsAt: null }] }, referenceTime), false);
assert.equal(isPastActivity({ ...finished, sessions: [{ startsAt: referenceTime, endsAt: null }] }, referenceTime), false);
assert.equal(isPastActivity({ ...finished, sessions: [] }, referenceTime), true);
assert.equal(isPastActivity(upcoming, referenceTime), false);

assert.deepEqual(currentActivityWhere(referenceTime), {
  status: "PUBLISHED",
  OR: [
    { sessions: { some: { OR: [{ endsAt: { gte: referenceTime } }, { endsAt: null, startsAt: { gte: referenceTime } }, { startsAt: null, endsAt: null }] } } },
    { sessions: { none: {} }, startsAt: { gte: referenceTime } },
    { sessions: { none: {} }, endsAt: { gte: referenceTime } },
    { sessions: { none: {} }, startsAt: null, endsAt: null },
  ],
});

assert.deepEqual(pastActivityWhere(referenceTime), {
  status: "PUBLISHED",
  OR: [
    {
      sessions: { some: {}, every: { OR: [{ endsAt: { lt: referenceTime } }, { endsAt: null, startsAt: { lt: referenceTime } }] } },
    },
    { sessions: { none: {} }, endsAt: { lt: referenceTime } },
    { sessions: { none: {} }, endsAt: null, startsAt: { lt: referenceTime } },
  ],
});

console.log("Activity visibility filters respect multi-session schedules");
