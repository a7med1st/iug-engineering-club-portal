import { NextResponse } from "next/server";

import { authorizeAuthenticatedApi } from "@/lib/api-auth";
import { privateNoStoreJson } from "@/lib/private-response";
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

  const auth = await authorizeAuthenticatedApi();
  if (!auth.authorized) return auth.response;
  const user = auth.user;

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

    prisma.notification.updateMany({
      where: {
        userId: user.id,
        chatConversationId: id,
        readAt: null,
      },
      data: {
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

  return privateNoStoreJson({ ok: true });
}
