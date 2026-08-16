import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { id } = await params;

  const participant = await prisma.chatParticipant.findUnique({
    where: {
      conversationId_userId: {
        conversationId: id,
        userId: session.sub,
      },
    },
    select: { userId: true },
  });

  if (!participant) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  let payload: { active?: boolean } = {};

  try {
    payload = await request.json();
  } catch {}

  if (!payload.active) {
    await prisma.chatTyping.deleteMany({
      where: {
        conversationId: id,
        userId: session.sub,
      },
    });

    return NextResponse.json({ ok: true });
  }

  const expiresAt = new Date(Date.now() + 4_000);

  await prisma.chatTyping.upsert({
    where: {
      conversationId_userId: {
        conversationId: id,
        userId: session.sub,
      },
    },
    create: {
      conversationId: id,
      userId: session.sub,
      expiresAt,
    },
    update: { expiresAt },
  });

  return NextResponse.json({
    ok: true,
    expiresAt: expiresAt.toISOString(),
  });
}
