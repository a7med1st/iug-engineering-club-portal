import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import {
  hasPermission,
  type Permission,
} from "@/lib/permissions";

type CurrentAuth = NonNullable<
  Awaited<ReturnType<typeof getCurrentUser>>
>;

export type ApiPermissionAuthorization =
  | {
      authorized: true;
      session: CurrentAuth["session"];
      user: CurrentAuth["user"];
    }
  | {
      authorized: false;
      response: NextResponse;
    };

export async function authorizeApiPermission(
  permission: Permission,
): Promise<ApiPermissionAuthorization> {
  const auth = await getCurrentUser();

  if (!auth) {
    return {
      authorized: false,
      response: NextResponse.json({ ok: false }, { status: 401 }),
    };
  }

  if (
    !hasPermission(
      auth.user.role,
      permission,
      auth.user.memberPermissions,
    )
  ) {
    return {
      authorized: false,
      response: NextResponse.json({ ok: false }, { status: 403 }),
    };
  }

  return {
    authorized: true,
    session: auth.session,
    user: auth.user,
  };
}
