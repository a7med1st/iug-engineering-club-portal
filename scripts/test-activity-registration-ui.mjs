import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../app/activities/[id]/register/page.tsx", import.meta.url), "utf8");

assert.doesNotMatch(page, /المقاعد المتبقية/);
assert.match(page, /const isCapacityFull/);
assert.match(page, /occupiedSeats >= activity\.capacity/);

console.log("Activity registration UI tests passed.");
