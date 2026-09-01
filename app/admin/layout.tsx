import type {
  ReactNode,
} from "react";

import AdminNavigation from "@/components/admin/AdminNavigation";

import {
  ACTIVITY_ADMIN_PERMISSIONS,
  PERMISSIONS,
  hasAnyPermission,
  hasPermission,
  requireAdminAreaAccess,
} from "@/lib/permissions";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { user, hasContactAssignments } =
    await requireAdminAreaAccess();

  const allowedHrefs: string[] =
    [];

  if (
    hasAnyPermission(
      user.role,
      ACTIVITY_ADMIN_PERMISSIONS,
      user.memberPermissions,
      user.position,
    )
  ) {
    allowedHrefs.push(
      "/admin/activities",
    );
  }

  if (
    hasPermission(
      user.role,
      PERMISSIONS.MEMBER_MANAGE,
      user.memberPermissions,
      user.position,
    )
  ) {
    allowedHrefs.push(
      "/admin/members",
    );
  }

  if (
    hasPermission(
      user.role,
      PERMISSIONS.STRUCTURE_MANAGE,
      user.memberPermissions,
      user.position,
    )
  ) {
    allowedHrefs.push(
      "/admin/structure",
    );
  }

  if (
    hasPermission(
      user.role,
      PERMISSIONS.GUIDE_MANAGE,
      user.memberPermissions,
      user.position,
    )
  ) {
    allowedHrefs.push(
      "/admin/guides",
    );
  }

  if (
    hasPermission(
      user.role,
      PERMISSIONS.CONTACT_MANAGE,
      user.memberPermissions,
      user.position,
    ) || hasContactAssignments
  ) {
    allowedHrefs.push(
      "/admin/contact",
    );
  }

  return (
    <div className="admin-wrap">
      <AdminNavigation
        allowedHrefs={
          allowedHrefs
        }
        title={
          user.role === "ADMIN"
            ? "لوحة الإدارة"
            : "إدارة القسم"
        }
      />

      <div className="admin-main" data-page-transition-content>
        {children}
      </div>
    </div>
  );
}
