import assert from "node:assert/strict";
import { activityCalendar } from "../lib/activity-calendar";

const event = { id: "event-1", title: "ورشة هندسية، مرحبًا;\nBEGIN:VEVENT", location: "قاعة أ", startsAt: new Date("2026-10-20T10:00:00+03:00"), endsAt: new Date("2026-10-20T12:00:00+03:00") };
const result = activityCalendar(event, new Date("2026-10-19T00:00:00Z"))!;
assert.ok(result.includes("DTSTART:20261020T070000Z\r\n"));
assert.ok(result.includes("DTEND:20261020T090000Z\r\n"));
assert.equal((result.match(/\r\nBEGIN:VEVENT\r\n/g) ?? []).length, 1, "Text cannot inject calendar events");
assert.ok(result.includes("\\;\\nBEGIN:VEVENT"));
assert.equal(activityCalendar({ ...event, startsAt: null }), null);
assert.ok(!activityCalendar({ ...event, endsAt: null })!.includes("DTEND:"), "Do not invent an end time");
const long = activityCalendar({ ...event, title: "هندسة ".repeat(100) })!;
assert.ok(long.split("\r\n").every(line => Buffer.byteLength(line, "utf8") <= 75));
assert.ok(long.replace(/\r\n /g, "").includes(`SUMMARY:${"هندسة ".repeat(100)}`), "Arabic survives line folding");
const multiple = activityCalendar({ ...event, sessions: [{ title: "جلسة أولى", startsAt: event.startsAt, endsAt: event.endsAt }, { title: "جلسة ثانية", startsAt: new Date("2026-10-21T07:00:00Z"), endsAt: null }] })!;
assert.equal((multiple.match(/\r\nBEGIN:VEVENT\r\n/g) ?? []).length, 2);
assert.equal((multiple.match(/BEGIN:VCALENDAR/g) ?? []).length, 1);
console.log("Activity calendar tests passed.");
