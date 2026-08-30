import {
  NextResponse,
} from "next/server";

import { authorizeApiPermission } from "@/lib/api-auth";

import {
  getSystemGroupsForUser,
} from "@/lib/chat-groups";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic =
  "force-dynamic";

export async function GET() {
  const auth = await authorizeApiPermission(
    PERMISSIONS.MEMBER_DASHBOARD,
  );

  if (!auth.authorized) {
    return auth.response;
  }

  const groups =
    await getSystemGroupsForUser(
      auth.user.id,
    );

  return NextResponse.json({
    ok: true,

    groups:
      groups.map(
        (group) => ({
          id:
            group.id,

          name:
            group.name,

          participantCount:
            group.participantCount,

          unreadCount:
            group.unreadCount,

          lastMessage:
            group.lastMessage
              ? {
                  body:
                    group.lastMessage.body,

                  senderName:
                    group.lastMessage.sender.name,

                  createdAt:
                    group.lastMessage.createdAt.toISOString(),
                }
              : null,
        }),
      ),
  });
}
