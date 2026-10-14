import assert from "node:assert/strict";

import { getSessionAttendanceSummaries } from "../lib/activity-attendance-matrix";

const summaries = getSessionAttendanceSummaries(
  [
    { id: "session-1", title: "Session one" },
    { id: "session-2", title: "Session two" },
  ],
  [
    {
      status: "APPROVED",
      sessionAttendances: [{ sessionId: "session-1" }],
    },
    {
      status: "APPROVED",
      sessionAttendances: [],
    },
    {
      status: "APPROVED",
      sessionAttendances: [
        { sessionId: "session-1" },
        { sessionId: "session-2" },
      ],
    },
    {
      status: "SUBMITTED",
      sessionAttendances: [{ sessionId: "session-1" }],
    },
  ],
);

assert.deepEqual(summaries, [
  { sessionId: "session-1", presentCount: 2, totalCount: 3, rate: 67 },
  { sessionId: "session-2", presentCount: 1, totalCount: 3, rate: 33 },
]);

console.log("Activity attendance matrix session summaries passed");
