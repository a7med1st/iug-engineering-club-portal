"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { confirmAttendance } from "@/lib/attendance-confirmation";
import { attendanceDeps } from "@/lib/attendance-prisma";

export async function confirmSelfAttendance(formData: FormData) {
  const activityId = String(formData.get("activityId") ?? "");
  const token = String(formData.get("token") ?? "");
  const auth = await getCurrentUser();
  const path = `/attendance/${encodeURIComponent(activityId)}/${encodeURIComponent(token)}`;
  if (!auth) redirect(`/login?portal=student&returnTo=${encodeURIComponent(path)}`);
  const result = await confirmAttendance({ activityId, token, userId: auth.user.id, role: auth.user.role }, attendanceDeps());
  const key = result.ok ? (result.alreadyRecorded ? "already" : "success") : result.code.toLowerCase();
  redirect(`${path}?result=${encodeURIComponent(key)}`);
}
