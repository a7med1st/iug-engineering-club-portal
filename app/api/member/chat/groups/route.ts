import {
  NextResponse,
} from "next/server";

import {
  getSession,
} from "@/lib/auth";

import {
  getSystemGroupsForUser,
} from "@/lib/chat-groups";

export const dynamic =
  "force-dynamic";

export async function GET() {
  const session =
    await getSession();

  if (
    !session
  ) {
    return NextResponse.json(
      {
        ok: false,
      },
      {
        status: 401,
      },
    );
  }

  if (
    session.role !==
      "MEMBER" &&
    session.role !==
      "ADMIN"
  ) {
    return NextResponse.json(
      {
        ok: false,
      },
      {
        status: 403,
      },
    );
  }

  const groups =
    await getSystemGroupsForUser(
      session.sub,
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
