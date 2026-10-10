"use server";
import { revalidatePath } from "next/cache";
import { PERMISSIONS, requireActivityPermission } from "@/lib/permissions";
import { recordStaffSessionAttendance } from "@/lib/attendance-prisma";
export type MemberCheckInResult = {
  status: "IDLE" | "SUCCESS" | "ALREADY_CHECKED_IN" | "INVALID_QR" | "WRONG_ACTIVITY" | "NOT_APPROVED" | "UNAUTHORIZED" | "ACTIVITY_UNAVAILABLE" | "ERROR";
  message: string;
  student?: { name: string; email: string; department: string | null };
  checkedInAt?: string;
};
export async function checkInMemberQr(activityId: string, rawCode: string, sessionId?: string): Promise<MemberCheckInResult> {
  if (!activityId) return { status: "INVALID_QR", message: "النشاط غير صالح." };
  const { user } = await requireActivityPermission(PERMISSIONS.ATTENDANCE_SCAN, activityId);
  const code = rawCode.trim();
  if (!code.startsWith("ENGCLUB:") || !code.slice(8).trim()) return { status: "INVALID_QR", message: "رمز الدخول غير صالح." };
  try {
    const result = await recordStaffSessionAttendance({
      activityId, token: code.slice(8).trim(), sessionId, userId: user.id, source: "STAFF_QR", publishedOnly: true,
    });
    if (result.status === "SUCCESS") {
      for (const path of [`/admin/activities/${activityId}/registrations`, `/admin/activities/${activityId}/check-in`, `/member/check-in/${activityId}`, "/member/check-in", "/student"]) revalidatePath(path);
    }
    return result;
  } catch (error) {
    console.error("Session QR check-in failed", error);
    return { status: "ERROR", message: "تعذر تسجيل الحضور. حاول مرة أخرى." };
  }
}
