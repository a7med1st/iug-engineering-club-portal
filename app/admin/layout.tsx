import type { ReactNode } from "react";
import AdminNavigation from "@/components/admin/AdminNavigation";
import {
  PERMISSIONS,
  requirePermission,
} from "@/lib/permissions";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requirePermission(
    PERMISSIONS.ADMIN_DASHBOARD,
  );

  return (
    <div className="admin-wrap">
      <AdminNavigation />
      <div className="admin-main">{children}</div>
    </div>
  );
}