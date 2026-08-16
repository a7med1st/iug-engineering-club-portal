import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ONLINE_WINDOW_MS = 30_000;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { id } = await params;

  const membership = await prisma.chatParticipant.findUnique({
    where: {
      conversationId_userId: {
        conversationId: id,
        userId: session.sub,
      },
    },
    select: {
      conversation: {
        select: {
          participants: {
            where: { userId: { not: session.sub } },
            take: 1,
            select: {
              user: {
                select: {
                  id: true,
                  chatLastSeenAt: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!membership) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const partner =
    membership.conversation.participants[0]?.user;

  if (!partner) {
    return NextResponse.json({
      ok: true,
      online: false,
      typing: false,
      lastSeenAt: null,
    });
  }

  const now = new Date();

  const typing = await prisma.chatTyping.findUnique({
    where: {
      conversationId_userId: {
        conversationId: id,
        userId: partner.id,
      },
    },
    select: { expiresAt: true },
  });

  const online = Boolean(
    partner.chatLastSeenAt &&
      now.getTime() - partner.chatLastSeenAt.getTime() <=
        ONLINE_WINDOW_MS,
  );

  return NextResponse.json({
    ok: true,
    online,
    typing: Boolean(typing && typing.expiresAt > now),
    lastSeenAt:
      partner.chatLastSeenAt?.toISOString() ?? null,
  });
}
