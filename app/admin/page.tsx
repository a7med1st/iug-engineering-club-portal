import { redirect } from "next/navigation";

import {
  ACTIVITY_ADMIN_PERMISSIONS,
  ADMIN_AREA_PERMISSIONS,
  PERMISSIONS,
  hasAnyPermission,
  hasPermission,
  requireAnyPermission,
} from "@/lib/permissions";

export default async function AdminPage() {
  const { user } =
    await requireAnyPermission(
      ADMIN_AREA_PERMISSIONS,
    );

  /*
   * الأدمن الكامل يبدأ من صفحة الأنشطة.
   */
  if (user.role === "ADMIN") {
    redirect("/admin/activities");
  }

  /*
   * العضو يوجّه فقط إلى صفحة
   * يمتلك صلاحية فعلية للوصول إليها.
   */

  if (
    hasAnyPermission(
      user.role,
      ACTIVITY_ADMIN_PERMISSIONS,
      user.memberPermissions,
      user.position,
    )
  ) {
    redirect("/admin/activities");
  }

  if (
    hasPermission(
      user.role,
      PERMISSIONS.STRUCTURE_MANAGE,
      user.memberPermissions,
      user.position,
    )
  ) {
    redirect("/admin/structure");
  }

  if (
    hasPermission(
      user.role,
      PERMISSIONS.GUIDE_MANAGE,
      user.memberPermissions,
      user.position,
    )
  ) {
    redirect("/admin/guides");
  }

  if (
    hasPermission(
      user.role,
      PERMISSIONS.CONTACT_MANAGE,
      user.memberPermissions,
      user.position,
    )
  ) {
    redirect("/admin/contact");
  }

  /*
   * احتياط أمني:
   * إذا لم تعد لديه أي صلاحية إدارية،
   * يرجع إلى بوابة العضو.
   */
  redirect("/member");
}