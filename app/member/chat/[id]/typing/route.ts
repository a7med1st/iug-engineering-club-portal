import { NextResponse } from "next/server";

import { authorizeApiPermission } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { rejectCrossOriginRequest } from "@/lib/request-security";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const crossOriginResponse = rejectCrossOriginRequest(request);

  if (crossOriginResponse) {
    return crossOriginResponse;
  }

  const auth = await authorizeApiPermission(
    PERMISSIONS.MEMBER_DASHBOARD,
  );

  if (!auth.authorized) {
    return auth.response;
  }

  const { id } = await params;

  const participant = await prisma.chatParticipant.findUnique({
    where: {
      conversationId_userId: {
        conversationId: id,
        userId: auth.user.id,
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
        userId: auth.user.id,
      },
    });

    return NextResponse.json({ ok: true });
  }

  const expiresAt = new Date(Date.now() + 4_000);

  await prisma.chatTyping.upsert({
    where: {
      conversationId_userId: {
        conversationId: id,
        userId: auth.user.id,
      },
    },
    create: {
      conversationId: id,
      userId: auth.user.id,
      expiresAt,
    },
    update: { expiresAt },
  });

  return NextResponse.json({
    ok: true,
    expiresAt: expiresAt.toISOString(),
  });
}
