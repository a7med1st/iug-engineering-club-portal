import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { formatActivityTimestamp } from "../lib/activities";

async function main() {
  const registration = new Date("2026-10-09T07:55:00.000Z");
  assert.match(formatActivityTimestamp(registration, "en-GB"), /10:55/);
  assert.match(formatActivityTimestamp(new Date("2026-12-09T07:55:00Z"), "en-GB"), /09:55/);
  assert.match(formatActivityTimestamp(new Date("2026-12-31T22:30:00Z"), "en-GB"), /1 Jan 2027, 00:30/);
  assert.equal(formatActivityTimestamp(null), "");
  assert.equal(registration.toISOString(), "2026-10-09T07:55:00.000Z");
  for (const timezone of ["UTC", "America/New_York", "Asia/Tokyo"]) {
    process.env.TZ = timezone;
    assert.match(formatActivityTimestamp(registration, "en-GB"), /10:55/);
  }
  for (const path of [
    "../app/admin/activities/[id]/registrations/page.tsx",
    "../app/admin/activities/[id]/registrations/export/route.ts",
  ]) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, /formatActivityTimestamp/);
  }
  console.log("Registration timestamp tests passed across server time zones and Palestinian summer/winter time.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
