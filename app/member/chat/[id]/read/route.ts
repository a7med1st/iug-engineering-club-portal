import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  if (!user || !["MEMBER", "ADMIN"].includes(user.role)) {
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

  await prisma.chatParticipant.update({
    where: {
      conversationId_userId: {
        conversationId: id,
        userId: user.id,
      },
    },
    data: { lastReadAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
