import {
  PERMISSIONS,
  requirePermission,
} from "@/lib/permissions";

/*
 * MEMBER و ADMIN مسموح لهم بتسجيل الحضور
 * لأن الصلاحية ATTENDANCE_SCAN موجودة لكلا الدورين.
 *
 * لو غيرنا الصلاحيات لاحقًا، لا نحتاج لتعديل
 * صفحات الـScanner نفسها.
 */
export async function requireAttendanceStaff() {
  return requirePermission(
    PERMISSIONS.ATTENDANCE_SCAN,
  );
}
