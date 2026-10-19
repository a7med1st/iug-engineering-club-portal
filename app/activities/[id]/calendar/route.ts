import { prisma } from "@/lib/prisma";
import { activityCalendar } from "@/lib/activity-calendar";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const activity = await prisma.activity.findFirst({
    where: { id, status: "PUBLISHED", deletedAt: null },
    select: { id: true, title: true, location: true, startsAt: true, endsAt: true, sessions: { orderBy: { sortOrder: "asc" }, select: { title: true, startsAt: true, endsAt: true } } },
  });
  if (!activity) return new Response("Not found", { status: 404 });
  const calendar = activityCalendar(activity);
  if (!calendar) return new Response("Schedule not available", { status: 404 });
  return new Response(calendar, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'attachment; filename="activity.ics"', "Cache-Control": "no-store" } });
}
