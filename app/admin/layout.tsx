import type { ReactNode } from "react";
import AdminNavigation from "@/components/admin/AdminNavigation";
import { requireAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();

  return (
    <div className="admin-wrap">
      <AdminNavigation />
      <div className="admin-main">{children}</div>
    </div>
  );
}
