import assert from "node:assert/strict";
import { currentActivityWhere, pastActivityWhere } from "../lib/activities";

const referenceTime = new Date("2026-10-11T09:00:00.000Z");

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
  status: { in: ["PUBLISHED", "ARCHIVED"] },
  OR: [
    {
      sessions: { some: {}, every: { OR: [{ endsAt: { lt: referenceTime } }, { endsAt: null, startsAt: { lt: referenceTime } }] } },
    },
    { sessions: { none: {} }, endsAt: { lt: referenceTime } },
    { sessions: { none: {} }, endsAt: null, startsAt: { lt: referenceTime } },
  ],
});

console.log("Activity visibility filters respect multi-session schedules");
