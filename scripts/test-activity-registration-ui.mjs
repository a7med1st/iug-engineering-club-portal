import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../app/activities/[id]/register/page.tsx", import.meta.url), "utf8");
const ticker = await readFile(new URL("../components/ClubUpdatesTicker.tsx", import.meta.url), "utf8");
const studentPage = await readFile(new URL("../app/student/page.tsx", import.meta.url), "utf8");
const attendancePage = await readFile(new URL("../app/attendance/[activityId]/[token]/page.tsx", import.meta.url), "utf8");

assert.doesNotMatch(page, /المقاعد المتبقية/);
assert.match(page, /const isCapacityFull/);
assert.match(page, /occupiedSeats >= activity\.capacity/);
assert.match(ticker, /href=\{activeUpdate\.href\}[\s\S]*?prefetch=\{false\}/);
assert.match(studentPage, /href=\{`\/activities\/\$\{activity\.id\}\/register`\}[\s\S]*?prefetch=\{false\}/);
assert.match(attendancePage, /href=\{`\/activities\/\$\{activityId\}\/register\?returnTo=\$\{encodeURIComponent\(path\)\}`\} prefetch=\{false\}/);

console.log("Activity registration UI tests passed.");
