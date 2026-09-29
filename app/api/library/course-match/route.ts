import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canAccessDepartment, hasPermission, PERMISSIONS } from "@/lib/permissions";
import { findLibraryCourseMatch } from "@/lib/library/courses";

export async function GET(request: Request) {
  const auth = await getCurrentUser();
  if (!auth) return NextResponse.json({ error: "غير مصرح." }, { status: 401 });
  const url = new URL(request.url);
  const departmentId = auth.user.role === "MEMBER" ? auth.user.departmentId : url.searchParams.get("departmentId");
  const adminAllowed = hasPermission(auth.user.role, PERMISSIONS.LIBRARY_MANAGE, auth.user.memberPermissions, auth.user.position);
  if (!departmentId || (auth.user.role !== "MEMBER" && (!adminAllowed || !canAccessDepartment(auth.user, departmentId)))) {
    return NextResponse.json({ error: "القسم غير متاح." }, { status: 403 });
  }
  const match = await findLibraryCourseMatch(url.searchParams.get("code"));
  return NextResponse.json({ match });
}
