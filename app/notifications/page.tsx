import { redirect } from "next/navigation";

import NotificationsClient from "./NotificationsClient";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return <NotificationsClient />;
}
