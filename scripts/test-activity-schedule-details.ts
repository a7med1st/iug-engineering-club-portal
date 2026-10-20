import assert from "node:assert/strict";
import { activityScheduleDetails } from "../lib/activities";

const start = new Date("2026-10-17T08:00:00Z");
const end = new Date("2026-10-17T11:00:00Z");
const sameDay = activityScheduleDetails(start, end);
assert.equal(sameDay.date, "17/10/2026");
assert.match(sameDay.time!, /11:00.*2:00/);
assert.ok(!sameDay.time!.includes("2026"));

const overnight = activityScheduleDetails(new Date("2026-10-17T20:00:00Z"), new Date("2026-10-17T22:00:00Z"));
assert.equal(overnight.date, "17/10/2026 – 18/10/2026");
const sameLocalDay = activityScheduleDetails(new Date("2026-10-16T22:00:00Z"), start);
assert.equal(sameLocalDay.date, "17/10/2026");
assert.equal(activityScheduleDetails(start, null).time, activityScheduleDetails(start, start).time);
assert.equal(activityScheduleDetails(null, end).date, "17/10/2026");
assert.equal(activityScheduleDetails(null, null).time, null);
console.log("Activity date/time details: same-day, local midnight, ranges and missing dates passed.");
