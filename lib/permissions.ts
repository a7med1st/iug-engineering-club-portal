import type { Role } from "@prisma/client";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const PERMISSIONS = {
  /* =========================
     STUDENT
  ========================= */

  STUDENT_DASHBOARD:
    "STUDENT_DASHBOARD",

  STUDENT_PROFILE_EDIT:
    "STUDENT_PROFILE_EDIT",

  ACTIVITY_REGISTER:
    "ACTIVITY_REGISTER",

  ACTIVITY_CANCEL_OWN_REGISTRATION:
    "ACTIVITY_CANCEL_OWN_REGISTRATION",

  /* =========================
     MEMBER
  ========================= */

  MEMBER_DASHBOARD:
    "MEMBER_DASHBOARD",

  /*
   * MEMBER + ADMIN
   * مسح QR فقط.
   */
  ATTENDANCE_SCAN:
    "ATTENDANCE_SCAN",

  /* =========================
     ADMIN - ACTIVITIES
  ========================= */

  ADMIN_DASHBOARD:
    "ADMIN_DASHBOARD",

  ACTIVITY_MANAGE:
    "ACTIVITY_MANAGE",

  ACTIVITY_ARCHIVE:
    "ACTIVITY_ARCHIVE",

  /* =========================
     ADMIN - REGISTRATIONS
  ========================= */

  /*
   * قبول / رفض / إعادة للمراجعة.
   */
  REGISTRATION_REVIEW:
    "REGISTRATION_REVIEW",

  /*
   * تعديل السعة وفتح/إغلاق التسجيل.
   */
  REGISTRATION_SETTINGS:
    "REGISTRATION_SETTINGS",

  /*
   * تسجيل أو إلغاء الحضور يدويًا.
   * لا نعطيها للـ MEMBER.
   */
  ATTENDANCE_MANUAL:
    "ATTENDANCE_MANUAL",

  REGISTRATION_EXPORT:
    "REGISTRATION_EXPORT",

  /*
   * نحتفظ بها كصلاحية عامة
   * لو احتجناها في صفحة إدارية شاملة.
   */
  REGISTRATION_MANAGE:
    "REGISTRATION_MANAGE",

  /* =========================
     ADMIN - OTHER MODULES
  ========================= */

  MEMBER_MANAGE:
    "MEMBER_MANAGE",

  STRUCTURE_MANAGE:
    "STRUCTURE_MANAGE",

  GUIDE_MANAGE:
    "GUIDE_MANAGE",

  CONTACT_MANAGE:
    "CONTACT_MANAGE",
} as const;

export type Permission =
  (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ROLE_PERMISSIONS: Record<
  Role,
  readonly Permission[]
> = {
  STUDENT: [
    PERMISSIONS.STUDENT_DASHBOARD,
    PERMISSIONS.STUDENT_PROFILE_EDIT,
    PERMISSIONS.ACTIVITY_REGISTER,
    PERMISSIONS.ACTIVITY_CANCEL_OWN_REGISTRATION,
  ],

  MEMBER: [
    PERMISSIONS.MEMBER_DASHBOARD,
    PERMISSIONS.ATTENDANCE_SCAN,
  ],

  ADMIN: [
    PERMISSIONS.ADMIN_DASHBOARD,

    /*
     * الأدمن يستطيع أيضًا استخدام
     * بوابة العضو والـQR Scanner.
     */
    PERMISSIONS.MEMBER_DASHBOARD,
    PERMISSIONS.ATTENDANCE_SCAN,

    PERMISSIONS.ACTIVITY_MANAGE,
    PERMISSIONS.ACTIVITY_ARCHIVE,

    PERMISSIONS.REGISTRATION_REVIEW,
    PERMISSIONS.REGISTRATION_SETTINGS,
    PERMISSIONS.ATTENDANCE_MANUAL,
    PERMISSIONS.REGISTRATION_EXPORT,
    PERMISSIONS.REGISTRATION_MANAGE,

    PERMISSIONS.MEMBER_MANAGE,
    PERMISSIONS.STRUCTURE_MANAGE,
    PERMISSIONS.GUIDE_MANAGE,
    PERMISSIONS.CONTACT_MANAGE,
  ],
};

export function hasPermission(
  role: Role,
  permission: Permission,
) {
  return ROLE_PERMISSIONS[
    role
  ].includes(permission);
}

export function hasAnyPermission(
  role: Role,
  permissions: readonly Permission[],
) {
  return permissions.some(
    (permission) =>
      hasPermission(
        role,
        permission,
      ),
  );
}

export function hasAllPermissions(
  role: Role,
  permissions: readonly Permission[],
) {
  return permissions.every(
    (permission) =>
      hasPermission(
        role,
        permission,
      ),
  );
}

function dashboardForRole(
  role: Role,
) {
  if (role === "ADMIN") {
    return "/admin";
  }

  if (role === "MEMBER") {
    return "/member";
  }

  return "/student";
}

/*
 * هذا هو الـGuard الأساسي.
 *
 * لا نعتمد على role الموجود داخل الـcookie وحده.
 * نقرأ المستخدم الحالي من قاعدة البيانات في كل عملية
 * حساسة، وبالتالي تغيير دوره من الإدارة ينعكس مباشرة.
 */
export async function requirePermission(
  permission: Permission,
) {
  const session =
    await getSession();

  if (!session) {
    redirect("/login");
  }

  const user =
    await prisma.user.findUnique({
      where: {
        id: session.sub,
      },

      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        position: true,
        departmentId: true,

        department: {
          select: {
            id: true,
            nameAr: true,
            nameEn: true,
          },
        },
      },
    });

  if (!user) {
    redirect("/login");
  }

  if (
    !hasPermission(
      user.role,
      permission,
    )
  ) {
    redirect(
      dashboardForRole(
        user.role,
      ),
    );
  }

  return {
    session,
    user,
  };
}

export async function requireAnyPermission(
  permissions: readonly Permission[],
) {
  const session =
    await getSession();

  if (!session) {
    redirect("/login");
  }

  const user =
    await prisma.user.findUnique({
      where: {
        id: session.sub,
      },

      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        position: true,
        departmentId: true,

        department: {
          select: {
            id: true,
            nameAr: true,
            nameEn: true,
          },
        },
      },
    });

  if (!user) {
    redirect("/login");
  }

  if (
    !hasAnyPermission(
      user.role,
      permissions,
    )
  ) {
    redirect(
      dashboardForRole(
        user.role,
      ),
    );
  }

  return {
    session,
    user,
  };
}