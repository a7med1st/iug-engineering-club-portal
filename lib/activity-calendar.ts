type CalendarActivity = { id: string; title: string; location: string; startsAt: Date | null; endsAt: Date | null; sessions?: { title: string; startsAt: Date | null; endsAt: Date | null }[] };

function escapeText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
}
function foldLine(line: string) {
  const encoder = new TextEncoder();
  let result = "", length = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    if (length + bytes > 75) { result += "\r\n "; length = 1; }
    result += char; length += bytes;
  }
  return result;
}
const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

export function activityCalendar(activity: CalendarActivity, now = new Date()): string | null {
  if (activity.sessions?.some(session => session.startsAt)) {
    const events = activity.sessions.flatMap((session, index) => {
      const calendar = activityCalendar({ ...activity, sessions: undefined, id: `${activity.id}-${index}`, title: `${activity.title} — ${session.title}`, startsAt: session.startsAt, endsAt: session.endsAt }, now);
      return calendar ? [calendar.slice(calendar.indexOf("BEGIN:VEVENT"), calendar.lastIndexOf("END:VCALENDAR"))] : [];
    });
    return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//IUG Engineering Club//Activities//AR", "CALSCALE:GREGORIAN"].join("\r\n") + "\r\n" + events.join("") + "END:VCALENDAR\r\n";
  }
  if (!activity.startsAt || !Number.isFinite(activity.startsAt.getTime())) return null;
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//IUG Engineering Club//Activities//AR", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
    `UID:${escapeText(activity.id)}@iug-engineering-club`, `DTSTAMP:${stamp(now)}`, `DTSTART:${stamp(activity.startsAt)}`,
    ...(activity.endsAt && activity.endsAt > activity.startsAt ? [`DTEND:${stamp(activity.endsAt)}`] : []),
    `SUMMARY:${escapeText(activity.title)}`, `LOCATION:${escapeText(activity.location)}`, "END:VEVENT", "END:VCALENDAR"];
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
