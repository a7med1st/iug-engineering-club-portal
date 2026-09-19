"use server";
import { revalidatePath } from "next/cache";
import { PERMISSIONS, requireActivityPermission } from "@/lib/permissions";
import { createAttendanceToken, validateAttendanceWindow } from "@/lib/attendance-links";
import { prisma } from "@/lib/prisma";
export type AttendanceLinkActionState = { ok: boolean; message: string; token?: string };
const date = (value: FormDataEntryValue | null) => { const text = String(value ?? "").trim(); return text ? new Date(text) : null; };
export async function saveAttendanceLink(_: AttendanceLinkActionState, formData: FormData): Promise<AttendanceLinkActionState> {
  const activityId = String(formData.get("activityId") ?? "");
  const { user } = await requireActivityPermission(PERMISSIONS.ATTENDANCE_MANUAL, activityId);
  const opensAt = date(formData.get("opensAt")); const closesAt = date(formData.get("closesAt"));
  if ((opensAt && Number.isNaN(opensAt.getTime())) || (closesAt && Number.isNaN(closesAt.getTime()))) return { ok: false, message: "صيغة الوقت غير صالحة." };
  const error = validateAttendanceWindow(opensAt, closesAt); if (error) return { ok: false, message: error };
  const existing = await prisma.activityAttendanceLink.findUnique({ where: { activityId } });
  if (existing) { await prisma.activityAttendanceLink.update({ where: { id: existing.id }, data: { isActive: formData.get("isActive") === "on", opensAt, closesAt } }); revalidatePath(`/admin/activities/${activityId}/registrations`); return { ok: true, message: "تم حفظ إعدادات الرابط." }; }
  const generated = createAttendanceToken();
  await prisma.activityAttendanceLink.create({ data: { activityId, createdById: user.id, tokenHash: generated.tokenHash, tokenPrefix: generated.tokenPrefix, opensAt, closesAt } });
  revalidatePath(`/admin/activities/${activityId}/registrations`); return { ok: true, message: "تم إنشاء الرابط. انسخه الآن.", token: generated.token };
}
export async function rotateAttendanceLink(_: AttendanceLinkActionState, formData: FormData): Promise<AttendanceLinkActionState> {
  const activityId = String(formData.get("activityId") ?? ""); await requireActivityPermission(PERMISSIONS.ATTENDANCE_MANUAL, activityId);
  const generated = createAttendanceToken(); await prisma.activityAttendanceLink.update({ where: { activityId }, data: { tokenHash: generated.tokenHash, tokenPrefix: generated.tokenPrefix, rotatedAt: new Date(), isActive: true } });
  revalidatePath(`/admin/activities/${activityId}/registrations`); return { ok: true, message: "تم إبطال الرابط السابق وإنشاء رابط جديد.", token: generated.token };
}
