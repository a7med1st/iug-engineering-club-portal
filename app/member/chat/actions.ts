"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  PERMISSIONS,
  requirePermission,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

function text(formData: FormData, field: string) {
  return String(formData.get(field) ?? "").trim();
}

function chatError(message: string): never {
  redirect(`/member/chat?error=${encodeURIComponent(message)}`);
}

function conversationError(
  conversationId: string,
  message: string,
): never {
  redirect(
    `/member/chat/${conversationId}?error=${encodeURIComponent(message)}`,
  );
}

function directKey(firstUserId: string, secondUserId: string) {
  return [firstUserId, secondUserId].sort().join(":");
}

export async function startDirectConversation(formData: FormData) {
  const { user } = await requirePermission(PERMISSIONS.MEMBER_DASHBOARD);
  const targetUserId = text(formData, "targetUserId");

  if (!targetUserId) chatError("اختر عضوًا لبدء المحادثة.");
  if (targetUserId === user.id) chatError("لا يمكنك بدء محادثة مع نفسك.");

  const target = await prisma.user.findFirst({
    where: {
      id: targetUserId,
      role: { in: ["MEMBER", "ADMIN"] },
    },
    select: { id: true },
  });

  if (!target) {
    chatError("العضو المحدد غير موجود أو غير متاح للمحادثة.");
  }

  const key = directKey(user.id, target.id);
  const existing = await prisma.chatConversation.findUnique({
    where: { directKey: key },
    select: { id: true },
  });

  if (existing) redirect(`/member/chat/${existing.id}`);

  let conversationId: string;

  try {
    const conversation = await prisma.chatConversation.create({
      data: {
        type: "DIRECT",
        directKey: key,
        participants: {
          create: [
            { user: { connect: { id: user.id } } },
            { user: { connect: { id: target.id } } },
          ],
        },
      },
      select: { id: true },
    });

    conversationId = conversation.id;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const conversation = await prisma.chatConversation.findUnique({
        where: { directKey: key },
        select: { id: true },
      });

      if (!conversation) throw error;
      conversationId = conversation.id;
    } else {
      throw error;
    }
  }

  revalidatePath("/member/chat");
  redirect(`/member/chat/${conversationId}`);
}

export async function sendChatMessage(formData: FormData) {
  const { user } = await requirePermission(PERMISSIONS.MEMBER_DASHBOARD);

  const conversationId = text(formData, "conversationId");
  const body = text(formData, "body");

  if (!conversationId) chatError("المحادثة غير صالحة.");
  if (!body) conversationError(conversationId, "اكتب رسالة أولًا.");
  if (body.length > 3000) {
    conversationError(
      conversationId,
      "الرسالة طويلة جدًا. الحد الأقصى 3000 حرف.",
    );
  }

  const participant = await prisma.chatParticipant.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId: user.id,
      },
    },
    select: { conversationId: true },
  });

  if (!participant) redirect("/member/chat");

  const now = new Date();

  await prisma.$transaction([
    prisma.chatMessage.create({
      data: {
        conversationId,
        senderId: user.id,
        body,
      },
    }),
    prisma.chatConversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: now },
    }),
    prisma.chatParticipant.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId: user.id,
        },
      },
      data: { lastReadAt: now },
    }),
  ]);

  revalidatePath("/member/chat");
  revalidatePath(`/member/chat/${conversationId}`);
}
