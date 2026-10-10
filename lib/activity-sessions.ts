import type { Prisma } from "@prisma/client";
import { activityDateTimeFromInput } from "./activities";

export class ActivitySessionsError extends Error {}
export type SessionInput = { id: string | null; title: string; sortOrder: number; startsAt: Date | null; endsAt: Date | null };
export type ActivitySessionsConfiguration = { sessions: SessionInput[]; requiredAttendanceCount: number; confirmedDeletedSessionIds: string[] };

export function parseActivitySessions(form: FormData): ActivitySessionsConfiguration {
  const raw = form.get("activitySessions");
  let value: unknown;
  try { value = raw === null ? { sessions: [{ title: "الجلسة الرئيسية" }], requiredAttendanceCount: 1 } : JSON.parse(String(raw)); }
  catch { throw new ActivitySessionsError("تعذر قراءة بيانات الجلسات."); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ActivitySessionsError("بيانات الجلسات غير صالحة.");
  const input = value as Record<string, unknown>;
  if (!Array.isArray(input.sessions) || !input.sessions.length) throw new ActivitySessionsError("أضف جلسة واحدة على الأقل.");
  const requiredAttendanceCount = input.requiredAttendanceCount ?? 1;
  if (typeof requiredAttendanceCount !== "number" || !Number.isInteger(requiredAttendanceCount) || requiredAttendanceCount < 1 || requiredAttendanceCount > input.sessions.length) throw new ActivitySessionsError("عدد جلسات الحضور المطلوبة يجب أن يكون بين 1 وعدد الجلسات.");
  const sessions = input.sessions.map((item, sortOrder): SessionInput => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new ActivitySessionsError("بيانات الجلسة غير صالحة.");
    const row = item as Record<string, unknown>;
    if (typeof row.title !== "string" || !row.title.trim() || row.title.trim().length > 160) throw new ActivitySessionsError("اكتب اسمًا للجلسة لا يتجاوز 160 حرفًا.");
    if (row.id != null && (typeof row.id !== "string" || !row.id.trim())) throw new ActivitySessionsError("معرّف الجلسة غير صالح.");
    const date = (prefix: string) => {
      const day = row[`${prefix}Date`] ?? "";
      const time = row[`${prefix}Time`] ?? "";
      if (!day && !time) return null;
      if (typeof day !== "string" || typeof time !== "string") throw new ActivitySessionsError("موعد الجلسة غير صالح.");
      const parsed = activityDateTimeFromInput(day, time);
      if (!parsed) throw new ActivitySessionsError("حدد تاريخ الجلسة ووقتها بشكل صحيح.");
      return parsed;
    };
    const startsAt = date("start"), endsAt = date("end");
    if (endsAt && (!startsAt || endsAt <= startsAt)) throw new ActivitySessionsError("نهاية الجلسة يجب أن تكون بعد بدايتها.");
    return { id: typeof row.id === "string" ? row.id.trim() : null, title: row.title.trim(), sortOrder, startsAt, endsAt };
  });
  const ids = sessions.flatMap(row => row.id ? [row.id] : []);
  if (new Set(ids).size !== ids.length) throw new ActivitySessionsError("معرّفات الجلسات مكررة.");
  const confirmed = input.confirmedDeletedSessionIds ?? [];
  if (!Array.isArray(confirmed) || confirmed.some(id => typeof id !== "string" || !id)) throw new ActivitySessionsError("تأكيد حذف الجلسات غير صالح.");
  return { sessions, requiredAttendanceCount, confirmedDeletedSessionIds: confirmed as string[] };
}

export function validateSessionChanges(config: ActivitySessionsConfiguration, current: { id: string; attendanceCount: number }[]) {
  const owned = new Set(current.map(row => row.id));
  const retained = new Set(config.sessions.flatMap(row => row.id ? [row.id] : []));
  if ([...retained, ...config.confirmedDeletedSessionIds].some(id => !owned.has(id))) throw new ActivitySessionsError("الجلسة لا تتبع هذا النشاط.");
  const removed = current.filter(row => !retained.has(row.id));
  if (removed.some(row => row.attendanceCount > 0 && !config.confirmedDeletedSessionIds.includes(row.id))) throw new ActivitySessionsError("حذف جلسة لها سجلات حضور يتطلب تأكيدًا صريحًا. أعد فتح المحرر وأكد الحذف.");
  return removed.map(row => row.id);
}

export async function updateActivitySessions(transaction: Prisma.TransactionClient, activityId: string, config: ActivitySessionsConfiguration) {
  // Lock the parent and existing sessions before rechecking attendance and ownership.
  await transaction.$queryRaw`SELECT "id" FROM "Activity" WHERE "id" = ${activityId} FOR UPDATE`;
  await transaction.$queryRaw`SELECT "id" FROM "ActivitySession" WHERE "activityId" = ${activityId} FOR UPDATE`;
  const current = await transaction.activitySession.findMany({ where: { activityId }, select: { id: true, _count: { select: { attendances: true } } } });
  const removed = validateSessionChanges(config, current.map(row => ({ id: row.id, attendanceCount: row._count.attendances })));
  if (removed.length) await transaction.activitySession.deleteMany({ where: { activityId, id: { in: removed } } });
  for (const { id, ...data } of config.sessions) {
    if (id) await transaction.activitySession.update({ where: { id, activityId }, data });
    else await transaction.activitySession.create({ data: { activityId, ...data } });
  }
  await transaction.activity.update({ where: { id: activityId }, data: { requiredAttendanceCount: config.requiredAttendanceCount } });
}
