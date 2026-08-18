import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
const ONLINE_MS = 30_000;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  const { id } = await params;
  const membership = await prisma.chatParticipant.findUnique({
    where: { conversationId_userId: { conversationId: id, userId: session.sub } },
    select: {
      conversation: {
        select: {
          type: true,
          participants: {
            select: { user: { select: { id: true, chatLastSeenAt: true } } },
          },
        },
      },
    },
  });
  if (!membership || membership.conversation.type !== "GROUP") {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  const now = new Date();
  const typing = await prisma.chatTyping.findMany({
    where: {
      conversationId: id,
      userId: { not: session.sub },
      expiresAt: { gt: now },
    },
    include: { user: { select: { name: true } } },
    take: 4,
    orderBy: { updatedAt: "desc" },
  });
  const onlineCount = membership.conversation.participants.filter((p) => {
    const seen = p.user.chatLastSeenAt;
    return Boolean(seen && now.getTime() - seen.getTime() <= ONLINE_MS);
  }).length;
  return NextResponse.json({
    ok: true,
    typingNames: typing.map((x) => x.user.name),
    onlineCount,
  });
}
