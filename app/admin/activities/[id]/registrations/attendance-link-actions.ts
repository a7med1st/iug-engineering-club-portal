"use server";
import { revalidatePath } from "next/cache";
import { PERMISSIONS, requireActivityPermission } from "@/lib/permissions";
import { createAttendanceToken, validateAttendanceWindow } from "@/lib/attendance-links";
import { attendanceTransaction } from "@/lib/attendance-prisma";
export type AttendanceLinkActionState = { ok: boolean; message: string; token?: string };
const date = (value: FormDataEntryValue | null) => { const text = String(value ?? "").trim(); return text ? new Date(text) : null; };

async function mutateLink(formData: FormData, rotate: boolean): Promise<AttendanceLinkActionState> {
  const activityId = String(formData.get("activityId") ?? "").trim();
  const requestedSession = String(formData.get("sessionId") ?? "").trim();
  const { user } = await requireActivityPermission(PERMISSIONS.ACTIVITY_MANAGE, activityId);
  const opensAt = date(formData.get("opensAt"));
  const closesAt = date(formData.get("closesAt"));
  if (!rotate) {
    if ((opensAt && Number.isNaN(opensAt.getTime())) || (closesAt && Number.isNaN(closesAt.getTime()))) return { ok: false, message: "صيغة الوقت غير صالحة." };
    const error = validateAttendanceWindow(opensAt, closesAt);
    if (error) return { ok: false, message: error };
  }
  const result = await attendanceTransaction(async tx => {
    const sessions = await tx.activitySession.findMany({ where: { activityId }, select: { id: true } });
    const sessionId = requestedSession || (sessions.length === 1 ? sessions[0].id : "");
    if (!sessions.some(session => session.id === sessionId)) return { ok: false, message: "اختر جلسة صالحة لهذا النشاط." };
    const existing = await tx.activityAttendanceLink.findUnique({ where: { sessionId } });
    if (existing && !rotate) {
      await tx.activityAttendanceLink.update({ where: { id: existing.id }, data: { isActive: formData.get("isActive") === "on", opensAt, closesAt } });
      return { ok: true, message: "تم حفظ إعدادات رابط الجلسة." };
    }
    const generated = createAttendanceToken();
    if (existing) {
      await tx.activityAttendanceLink.update({ where: { id: existing.id }, data: { tokenHash: generated.tokenHash, tokenPrefix: generated.tokenPrefix, rotatedAt: new Date(), isActive: true } });
    } else {
      await tx.activityAttendanceLink.create({ data: { activityId, sessionId, createdById: user.id, tokenHash: generated.tokenHash, tokenPrefix: generated.tokenPrefix, opensAt, closesAt } });
    }
    return { ok: true, message: "تم إنشاء رابط الجلسة. انسخه الآن.", token: generated.token };
  });
  if (result.ok) revalidatePath(`/admin/activities/${activityId}/registrations`);
  return result;
}
export async function saveAttendanceLink(_: AttendanceLinkActionState, formData: FormData) { return mutateLink(formData, false); }
export async function rotateAttendanceLink(_: AttendanceLinkActionState, formData: FormData) { return mutateLink(formData, true); }
