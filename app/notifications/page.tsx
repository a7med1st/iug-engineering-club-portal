import NotificationsClient from "./NotificationsClient";
import { getCurrentPermissionUser } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  await getCurrentPermissionUser();

  return <NotificationsClient />;
}
