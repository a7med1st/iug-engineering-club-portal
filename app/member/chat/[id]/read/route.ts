import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { id: true, role: true },
  });

  if (
    !user ||
    (user.role !== "MEMBER" && user.role !== "ADMIN")
  ) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const { id } = await params;

  const membership = await prisma.chatParticipant.findUnique({
    where: {
      conversationId_userId: {
        conversationId: id,
        userId: user.id,
      },
    },
    select: { conversationId: true },
  });

  if (!membership) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const now = new Date();

  await prisma.$transaction([
    prisma.chatParticipant.update({
      where: {
        conversationId_userId: {
          conversationId: id,
          userId: user.id,
        },
      },
      data: { lastReadAt: now },
    }),

    prisma.chatMessageReceipt.updateMany({
      where: {
        userId: user.id,
        readAt: null,
        message: { conversationId: id },
      },
      data: {
        deliveredAt: now,
        readAt: now,
      },
    }),

    prisma.chatTyping.deleteMany({
      where: {
        conversationId: id,
        userId: user.id,
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
