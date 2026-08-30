"use server";

import {
  Prisma,
} from "@prisma/client";

import {
  revalidatePath,
} from "next/cache";

import {
  redirect,
} from "next/navigation";

import {
  PERMISSIONS,
  requirePermission,
} from "@/lib/permissions";

import {
  prisma,
} from "@/lib/prisma";

import {
  ChatAttachmentStorageError,
  tryDeleteChatAttachment,
  uploadChatAttachment,
} from "@/lib/chat-attachment-storage";
import {
  UploadRateLimitError,
  enforceChatUploadLimit,
  uploadRateLimitMessage,
} from "@/lib/upload-rate-limit";

function text(
  formData: FormData,
  field: string,
) {
  return String(
    formData.get(
      field,
    ) ?? "",
  ).trim();
}

function chatError(
  message: string,
): never {
  redirect(
    `/member/chat?error=${encodeURIComponent(
      message,
    )}`,
  );
}

function conversationError(
  conversationId: string,
  message: string,
): never {
  redirect(
    `/member/chat/${conversationId}?error=${encodeURIComponent(
      message,
    )}`,
  );
}

function directKey(
  firstUserId: string,
  secondUserId: string,
) {
  return [
    firstUserId,
    secondUserId,
  ]
    .sort()
    .join(":");
}

function messagePreview(
  body: string,
) {
  if (
    body.length <=
    120
  ) {
    return body;
  }

  return `${body.slice(
    0,
    117,
  )}...`;
}

export async function startDirectConversation(
  formData: FormData,
) {
  const {
    user,
  } =
    await requirePermission(
      PERMISSIONS.MEMBER_DASHBOARD,
    );

  const targetUserId =
    text(
      formData,
      "targetUserId",
    );

  if (
    !targetUserId
  ) {
    chatError(
      "اختر عضوًا لبدء المحادثة.",
    );
  }

  if (
    targetUserId ===
    user.id
  ) {
    chatError(
      "لا يمكنك بدء محادثة مع نفسك.",
    );
  }

  const target =
    await prisma.user.findFirst({
      where: {
        id:
          targetUserId,

        role: {
          in: [
            "MEMBER",
            "ADMIN",
          ],
        },
      },

      select: {
        id: true,
      },
    });

  if (
    !target
  ) {
    chatError(
      "العضو المحدد غير موجود أو غير متاح للمحادثة.",
    );
  }

  const key =
    directKey(
      user.id,
      target.id,
    );

  const existing =
    await prisma.chatConversation.findUnique({
      where: {
        directKey:
          key,
      },

      select: {
        id: true,
      },
    });

  if (
    existing
  ) {
    redirect(
      `/member/chat/${existing.id}`,
    );
  }

  let conversationId:
    string;

  try {
    const conversation =
      await prisma.chatConversation.create({
        data: {
          type:
            "DIRECT",

          directKey:
            key,

          participants: {
            create: [
              {
                user: {
                  connect: {
                    id:
                      user.id,
                  },
                },
              },

              {
                user: {
                  connect: {
                    id:
                      target.id,
                  },
                },
              },
            ],
          },
        },

        select: {
          id: true,
        },
      });

    conversationId =
      conversation.id;
  } catch (
    error
  ) {
    if (
      error instanceof
        Prisma.PrismaClientKnownRequestError &&
      error.code ===
        "P2002"
    ) {
      const conversation =
        await prisma.chatConversation.findUnique({
          where: {
            directKey:
              key,
          },

          select: {
            id: true,
          },
        });

      if (
        !conversation
      ) {
        throw error;
      }

      conversationId =
        conversation.id;
    } else {
      throw error;
    }
  }

  revalidatePath(
    "/member/chat",
  );

  redirect(
    `/member/chat/${conversationId}`,
  );
}

export type ChatComposerState = {
  status: "idle" | "success" | "error";
  message?: string;
  submissionId?: string;
};

export async function sendChatMessage(
  _previousState: ChatComposerState,
  formData: FormData,
): Promise<ChatComposerState> {
  const {
    user,
  } =
    await requirePermission(
      PERMISSIONS.MEMBER_DASHBOARD,
    );

  const conversationId =
    text(
      formData,
      "conversationId",
    );

  const body =
    text(
      formData,
      "body",
    );

  const pollQuestion = text(formData, "pollQuestion");
  const pollOptions = formData
    .getAll("pollOption")
    .map((value) => String(value).trim())
    .filter(Boolean);
  const attachmentValue = formData.get("attachment");
  const attachment =
    attachmentValue instanceof File && attachmentValue.size > 0
      ? attachmentValue
      : null;
  if (
    !conversationId
  ) {
    return { status: "error", message: "المحادثة غير صالحة." };
  }

  const participant =
    await prisma.chatParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,

          userId:
            user.id,
        },
      },

      select: {
        conversationId:
          true,

        conversation: {
          select: {
            type:
              true,

            name:
              true,
          },
        },
      },
    });

  if (
    !participant
  ) {
    return { status: "error", message: "لا يمكنك الإرسال إلى هذه المحادثة." };
  }

  const isGroup =
    participant
      .conversation
      .type ===
    "GROUP";

  const chatHref =
    isGroup
      ? `/member/chat/groups/${conversationId}`
      : `/member/chat/${conversationId}`;

  if (!body && !attachment && !pollQuestion) {
    return { status: "error", message: "اكتب رسالة أو أضف مرفقًا أو تصويتًا." };
  }

  if (
    body.length >
    3000
  ) {
    return {
      status: "error",
      message: "الرسالة طويلة جدًا. الحد الأقصى 3000 حرف.",
    };
  }

  if (pollQuestion) {
    if (attachment) {
      return { status: "error", message: "أرسل التصويت والمرفق كرسالتين منفصلتين." };
    }

    if (pollQuestion.length > 180) {
      return { status: "error", message: "سؤال التصويت أطول من 180 حرفًا." };
    }

    if (pollOptions.length < 2 || pollOptions.length > 6) {
      return { status: "error", message: "أضف من خيارين إلى 6 خيارات للتصويت." };
    }

    if (pollOptions.some((option) => option.length > 120)) {
      return { status: "error", message: "خيار التصويت أطول من 120 حرفًا." };
    }
  }

  let storedAttachment = null;

  if (attachment) {
    try {
      await enforceChatUploadLimit(user.id, conversationId, attachment.size);
      storedAttachment = await uploadChatAttachment(attachment, conversationId);
    } catch (error) {
      return {
        status: "error",
        message:
          error instanceof UploadRateLimitError
            ? uploadRateLimitMessage(error)
            : error instanceof ChatAttachmentStorageError
            ? error.message
            : "تعذر رفع الملف. حاول مرة أخرى.",
      };
    }
  }

  const kind = pollQuestion ? "POLL" : storedAttachment ? "ATTACHMENT" : "TEXT";
  const fallbackBody = pollQuestion
    ? `تصويت: ${pollQuestion}`
    : storedAttachment?.category === "audio"
      ? "رسالة صوتية"
      : storedAttachment?.mime.startsWith("image/")
        ? "صورة"
        : storedAttachment?.mime.startsWith("video/")
          ? "فيديو"
          : storedAttachment?.mime.startsWith("audio/")
            ? "ملف صوتي"
            : storedAttachment
              ? `ملف: ${storedAttachment.originalName}`
              : "";
  const messageBody = body || fallbackBody;

  const [
    recipients,
    sender,
  ] =
    await Promise.all([
      prisma.chatParticipant.findMany({
        where: {
          conversationId,

          userId: {
            not:
              user.id,
          },
        },

        select: {
          userId:
            true,
        },
      }),

      prisma.user.findUnique({
        where: {
          id:
            user.id,
        },

        select: {
          name:
            true,
        },
      }),
    ]);

  if (
    !sender
  ) {
    if (storedAttachment) {
      await tryDeleteChatAttachment(storedAttachment, "missing-chat-sender");
    }
    return { status: "error", message: "تعذر العثور على بيانات المرسل." };
  }

  const now =
    new Date();

  let createdMessageId = "";

  try {
    await prisma.$transaction(async (tx) => {
      const message =
        await tx.chatMessage.create({
          data: {
            conversationId,

            senderId:
              user.id,

            body: messageBody,
            kind,
            pollQuestion: pollQuestion || null,
            pollOptions: pollQuestion ? pollOptions : [],
            attachments: storedAttachment
              ? {
                  create: {
                    url: storedAttachment.url,
                    pathname: storedAttachment.pathname,
                    originalName: storedAttachment.originalName,
                    mime: storedAttachment.mime,
                    size: storedAttachment.size,
                  },
                }
              : undefined,
          },

          select: {
            id: true,
          },
        });

      createdMessageId = message.id;

      if (
        recipients.length
      ) {
        await tx.chatMessageReceipt.createMany({
          data:
            recipients.map(
              (
                recipient,
              ) => ({
                messageId:
                  message.id,

                userId:
                  recipient.userId,
              }),
            ),

          skipDuplicates:
            true,
        });

        await tx.notification.createMany({
          data:
            recipients.map(
              (
                recipient,
              ) => ({
                userId:
                  recipient.userId,

                type:
                  "CHAT_MESSAGE",

                title:
                  isGroup
                    ? `رسالة جديدة في ${participant.conversation.name ?? "المجموعة"}`
                    : `رسالة جديدة من ${sender.name}`,

                body:
                  isGroup
                    ? `${sender.name}: ${messagePreview(messageBody)}`
                    : messagePreview(messageBody),

                href:
                  chatHref,

                chatConversationId:
                  conversationId,

                chatMessageId:
                  message.id,
              }),
            ),

          skipDuplicates:
            true,
        });
      }

      await tx.chatConversation.update({
        where: {
          id:
            conversationId,
        },

        data: {
          lastMessageAt:
            now,
        },
      });

      await tx.chatParticipant.update({
        where: {
          conversationId_userId: {
            conversationId,

            userId:
              user.id,
          },
        },

        data: {
          lastReadAt:
            now,
        },
      });

      await tx.chatTyping.deleteMany({
        where: {
          conversationId,

          userId:
            user.id,
        },
      });
    });
  } catch {
    if (storedAttachment) {
      await tryDeleteChatAttachment(storedAttachment, "chat-db-failure");
    }
    return { status: "error", message: "تعذر إرسال الرسالة. حاول مرة أخرى." };
  }

  revalidatePath(
    "/member/chat",
  );

  revalidatePath(
    chatHref,
  );

  revalidatePath(
    "/notifications",
  );

  return {
    status: "success",
    submissionId: createdMessageId,
  };
}

export async function voteOnChatPoll(formData: FormData) {
  const { user } = await requirePermission(PERMISSIONS.MEMBER_DASHBOARD);
  const messageId = text(formData, "messageId");
  const optionIndex = Number(text(formData, "optionIndex"));

  if (!messageId || !Number.isInteger(optionIndex)) return;

  const message = await prisma.chatMessage.findFirst({
    where: {
      id: messageId,
      kind: "POLL",
      conversation: { participants: { some: { userId: user.id } } },
    },
    select: {
      conversationId: true,
      pollOptions: true,
      conversation: { select: { type: true } },
    },
  });

  if (!message || optionIndex < 0 || optionIndex >= message.pollOptions.length) return;

  await prisma.chatPollVote.upsert({
    where: { messageId_userId: { messageId, userId: user.id } },
    create: { messageId, userId: user.id, optionIndex },
    update: { optionIndex },
  });

  const href =
    message.conversation.type === "GROUP"
      ? `/member/chat/groups/${message.conversationId}`
      : `/member/chat/${message.conversationId}`;
  revalidatePath(href);
}
