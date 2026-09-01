import type { Role } from "@prisma/client";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/*
 * =========================================================
 * CENTRAL PERMISSIONS
 * =========================================================
 *
 * - STUDENT permissions are role-based.
 * - ADMIN always has every permission.
 * - MEMBER has MEMBER_DASHBOARD by default, and the rest
 *   comes from user.memberPermissions in the database.
 *
 * Department-scoped permissions are checked separately in
 * the module/action that owns the resource.
 */

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

  ATTENDANCE_SCAN:
    "ATTENDANCE_SCAN",

  /* =========================
     MANAGEMENT
  ========================= */

  ADMIN_DASHBOARD:
    "ADMIN_DASHBOARD",

  ACTIVITY_MANAGE:
    "ACTIVITY_MANAGE",

  ACTIVITY_ARCHIVE:
    "ACTIVITY_ARCHIVE",

  REGISTRATION_REVIEW:
    "REGISTRATION_REVIEW",

  REGISTRATION_SETTINGS:
    "REGISTRATION_SETTINGS",

  ATTENDANCE_MANUAL:
    "ATTENDANCE_MANUAL",

  REGISTRATION_EXPORT:
    "REGISTRATION_EXPORT",

  REGISTRATION_MANAGE:
    "REGISTRATION_MANAGE",

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

/*
 * Permissions that ADMIN is allowed to grant to a MEMBER.
 *
 * MEMBER_MANAGE and ADMIN_DASHBOARD are intentionally NOT
 * assignable to members.
 *
 * REGISTRATION_MANAGE is also kept admin-only because the
 * member QR flow already uses ATTENDANCE_SCAN.
 */
export const MEMBER_PERMISSION_OPTIONS = [
  {
    permission:
      PERMISSIONS.ACTIVITY_MANAGE,
    label:
      "إدارة أنشطة القسم",
    scope: "DEPARTMENT",
  },
  {
    permission:
      PERMISSIONS.ACTIVITY_ARCHIVE,
    label:
      "أرشفة واستعادة أنشطة القسم",
    scope: "DEPARTMENT",
  },
  {
    permission:
      PERMISSIONS.REGISTRATION_REVIEW,
    label:
      "مراجعة طلبات التسجيل",
    scope: "DEPARTMENT",
  },
  {
    permission:
      PERMISSIONS.REGISTRATION_SETTINGS,
    label:
      "إعدادات التسجيل والسعة",
    scope: "DEPARTMENT",
  },
  {
    permission:
      PERMISSIONS.ATTENDANCE_MANUAL,
    label:
      "تسجيل وإلغاء الحضور يدويًا",
    scope: "DEPARTMENT",
  },
  {
    permission:
      PERMISSIONS.REGISTRATION_EXPORT,
    label:
      "تصدير تسجيلات القسم",
    scope: "DEPARTMENT",
  },
  {
    permission:
      PERMISSIONS.ATTENDANCE_SCAN,
    label:
      "مسح QR لتسجيل الحضور",
    scope: "DEPARTMENT",
  },
  {
    permission:
      PERMISSIONS.GUIDE_MANAGE,
    label:
      "تعديل دليل القسم",
    scope: "DEPARTMENT",
  },
  {
    permission:
      PERMISSIONS.STRUCTURE_MANAGE,
    label:
      "إدارة عناصر هيكلية القسم",
    scope: "DEPARTMENT",
  },
  {
    permission:
      PERMISSIONS.CONTACT_MANAGE,
    label:
      "إدارة التواصل والشكاوى والاقتراحات",
    scope: "GLOBAL",
  },
] as const satisfies readonly {
  permission: Permission;
  label: string;
  scope:
    | "DEPARTMENT"
    | "GLOBAL";
}[];

export const MEMBER_ASSIGNABLE_PERMISSIONS =
  MEMBER_PERMISSION_OPTIONS.map(
    (item) =>
      item.permission,
  );

const MEMBER_ASSIGNABLE_SET =
  new Set<Permission>(
    MEMBER_ASSIGNABLE_PERMISSIONS,
  );

const DEPARTMENT_SCOPED_SET =
  new Set<Permission>([
    PERMISSIONS.ACTIVITY_MANAGE,
    PERMISSIONS.ACTIVITY_ARCHIVE,
    PERMISSIONS.REGISTRATION_REVIEW,
    PERMISSIONS.REGISTRATION_SETTINGS,
    PERMISSIONS.ATTENDANCE_MANUAL,
    PERMISSIONS.REGISTRATION_EXPORT,
    PERMISSIONS.REGISTRATION_MANAGE,
    PERMISSIONS.ATTENDANCE_SCAN,
    PERMISSIONS.GUIDE_MANAGE,
    PERMISSIONS.STRUCTURE_MANAGE,
  ]);

const STUDENT_PERMISSIONS =
  new Set<Permission>([
    PERMISSIONS.STUDENT_DASHBOARD,
    PERMISSIONS.STUDENT_PROFILE_EDIT,
    PERMISSIONS.ACTIVITY_REGISTER,
    PERMISSIONS.ACTIVITY_CANCEL_OWN_REGISTRATION,
  ]);

export const ADMIN_AREA_PERMISSIONS =
  [
    PERMISSIONS.ADMIN_DASHBOARD,
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
  ] as const;

const ADMIN_AREA_PERMISSION_SET =
  new Set<Permission>(
    ADMIN_AREA_PERMISSIONS,
  );

export const ACTIVITY_ADMIN_PERMISSIONS =
  [
    PERMISSIONS.ACTIVITY_MANAGE,
    PERMISSIONS.ACTIVITY_ARCHIVE,
    PERMISSIONS.REGISTRATION_REVIEW,
    PERMISSIONS.REGISTRATION_SETTINGS,
    PERMISSIONS.ATTENDANCE_MANUAL,
    PERMISSIONS.REGISTRATION_EXPORT,
    PERMISSIONS.REGISTRATION_MANAGE,
  ] as const;

export function isPermission(
  value: string,
): value is Permission {
  return Object.values(
    PERMISSIONS,
  ).includes(
    value as Permission,
  );
}

export function normalizeMemberPermissions(
  values: readonly string[],
): Permission[] {
  return [
    ...new Set(
      values.filter(
        (
          value,
        ): value is Permission =>
          isPermission(value) &&
          MEMBER_ASSIGNABLE_SET.has(
            value,
          ),
      ),
    ),
  ];
}

export function isDepartmentScopedPermission(
  permission: Permission,
) {
  return DEPARTMENT_SCOPED_SET.has(
    permission,
  );
}

export function hasPermission(
  role: Role,
  permission: Permission,
  memberPermissions: readonly string[] = [],
  position?: string | null,
) {
  if (role === "ADMIN") {
    return true;
  }

  if (isClubLeadership(position)) {
    if (
      permission === PERMISSIONS.MEMBER_MANAGE ||
      ADMIN_AREA_PERMISSION_SET.has(permission)
    ) {
      return true;
    }
  }

  if (role === "STUDENT") {
    return STUDENT_PERMISSIONS.has(
      permission,
    );
  }

  if (
    permission ===
    PERMISSIONS.MEMBER_DASHBOARD
  ) {
    return true;
  }

  return normalizeMemberPermissions(
    memberPermissions,
  ).includes(permission);
}

export function hasAnyPermission(
  role: Role,
  permissions: readonly Permission[],
  memberPermissions: readonly string[] = [],
  position?: string | null,
) {
  return permissions.some(
    (permission) =>
      hasPermission(
        role,
        permission,
        memberPermissions,
        position,
      ),
  );
}

export function hasAllPermissions(
  role: Role,
  permissions: readonly Permission[],
  memberPermissions: readonly string[] = [],
  position?: string | null,
) {
  return permissions.every(
    (permission) =>
      hasPermission(
        role,
        permission,
        memberPermissions,
        position,
      ),
  );
}

export type PermissionUser = {
  id: string;
  role: Role;
  departmentId: string | null;
  memberPermissions: string[];
  position?: string | null;
};

/**
 * Check if a member is a club president or vice president.
 * They have full permissions across all departments.
 */
export function isClubLeadership(position: string | null | undefined): boolean {
  if (!position) return false;
  const positionLower = position.toLowerCase();
  return (
    positionLower.includes("رئيس النادي") ||
    positionLower.includes("نائب رئيس النادي") ||
    positionLower.includes("club president") ||
    positionLower.includes("vice president")
  );
}

/*
 * ADMIN: any department.
 * CLUB_LEADER (President/Vice President): any department.
 * MEMBER: only the department stored on the account.
 */
export function canAccessDepartment(
  user: Pick<
    PermissionUser,
    "role" | "departmentId" | "position"
  >,
  departmentId: string,
) {
  if (user.role === "ADMIN") {
    return true;
  }

  // Club leaders have access to all departments
  if (isClubLeadership(user.position)) {
    return true;
  }

  return (
    user.role === "MEMBER" &&
    Boolean(user.departmentId) &&
    user.departmentId ===
      departmentId
  );
}

/*
 * Department representatives may manage only an activity
 * that belongs exclusively to their own department.
 *
 * Club leaders (President/Vice President) can manage any activity.
 *
 * General activities or multi-department activities remain
 * ADMIN-only because editing them affects other departments.
 */
export function canAccessActivityDepartments(
  user: Pick<
    PermissionUser,
    "role" | "departmentId" | "position"
  >,
  departmentIds: readonly string[],
) {
  if (user.role === "ADMIN") {
    return true;
  }

  // Club leaders can access activities from any department
  if (isClubLeadership(user.position)) {
    return true;
  }

  return (
    user.role === "MEMBER" &&
    Boolean(user.departmentId) &&
    departmentIds.length === 1 &&
    departmentIds[0] ===
      user.departmentId
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

export async function getCurrentPermissionUser() {
  const auth = await getCurrentUser();

  if (!auth) {
    redirect("/login");
  }

  if (auth.user.mustChangePassword) {
    redirect("/change-password");
  }

  return auth;
}

export async function hasAssignedContactRequests(
  userId: string,
) {
  const [complaint, suggestion, collaboration] =
    await Promise.all([
      prisma.complaint.findFirst({
        where: { assignedToId: userId },
        select: { id: true },
      }),
      prisma.suggestion.findFirst({
        where: { assignedToId: userId },
        select: { id: true },
      }),
      prisma.collaborationRequest.findFirst({
        where: { assignedToId: userId },
        select: { id: true },
      }),
    ]);

  return Boolean(
    complaint || suggestion || collaboration,
  );
}

export async function requireContactAccess() {
  const auth = await getCurrentPermissionUser();

  if (
    hasPermission(
      auth.user.role,
      PERMISSIONS.CONTACT_MANAGE,
      auth.user.memberPermissions,
      auth.user.position,
    ) ||
    (await hasAssignedContactRequests(auth.user.id))
  ) {
    return auth;
  }

  redirect(dashboardForRole(auth.user.role));
}

export async function requireAdminAreaAccess() {
  const auth = await getCurrentPermissionUser();
  const hasAdminPermission = hasAnyPermission(
    auth.user.role,
    ADMIN_AREA_PERMISSIONS,
    auth.user.memberPermissions,
    auth.user.position,
  );
  const hasContactAssignments = hasAdminPermission
    ? false
    : await hasAssignedContactRequests(auth.user.id);

  if (!hasAdminPermission && !hasContactAssignments) {
    redirect(dashboardForRole(auth.user.role));
  }

  return {
    ...auth,
    hasContactAssignments,
  };
}

/*
 * Main guard for pages and Server Actions.
 */
export async function requirePermission(
  permission: Permission,
) {
  const {
    session,
    user,
  } =
    await getCurrentPermissionUser();

  if (
    !hasPermission(
      user.role,
      permission,
      user.memberPermissions,
      user.position,
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

/*
 * Permission + department scope for one department.
 */
export async function requireDepartmentPermission(
  permission: Permission,
  departmentId: string,
) {
  const auth =
    await requirePermission(
      permission,
    );

  if (
    !canAccessDepartment(
      auth.user,
      departmentId,
    )
  ) {
    redirect(
      dashboardForRole(
        auth.user.role,
      ),
    );
  }

  return auth;
}

/*
 * Permission + department scope for an activity.
 *
 * MEMBER may access only an activity linked exclusively
 * to the member's own department. General and
 * multi-department activities remain ADMIN-only.
 */
export async function requireActivityPermission(
  permission: Permission,
  activityId: string,
) {
  const auth =
    await requirePermission(
      permission,
    );

  const activity =
    await prisma.activity.findUnique({
      where: {
        id: activityId,
      },

      select: {
        id: true,

        departments: {
          select: {
            departmentId: true,
          },
        },
      },
    });

  if (!activity) {
    redirect(
      dashboardForRole(
        auth.user.role,
      ),
    );
  }

  const departmentIds =
    activity.departments.map(
      (item) =>
        item.departmentId,
    );

  if (
    !canAccessActivityDepartments(
      auth.user,
      departmentIds,
    )
  ) {
    redirect(
      dashboardForRole(
        auth.user.role,
      ),
    );
  }

  return {
    ...auth,
    activity,
  };
}

export async function requireAnyPermission(
  permissions: readonly Permission[],
) {
  const {
    session,
    user,
  } =
    await getCurrentPermissionUser();

  if (
    !hasAnyPermission(
      user.role,
      permissions,
      user.memberPermissions,
      user.position,
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
