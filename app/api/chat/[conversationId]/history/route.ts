import { NextResponse } from "next/server";

import {
  authorizeAuthenticatedApi,
} from "@/lib/api-auth";
import {
  privateNoStoreJson,
} from "@/lib/private-response";
import { prisma } from "@/lib/prisma";

export const dynamic =
  "force-dynamic";

const DEFAULT_LIMIT = 120;
const MAX_LIMIT = 120;

function parseLimit(
  request: Request,
) {
  const url =
    new URL(request.url);

  const raw =
    Number(
      url.searchParams.get(
        "limit",
      ),
    );

  if (
    !Number.isFinite(raw) ||
    raw <= 0
  ) {
    return DEFAULT_LIMIT;
  }

  return Math.min(
    Math.floor(raw),
    MAX_LIMIT,
  );
}

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      conversationId: string;
    }>;
  },
) {
  const auth =
    await authorizeAuthenticatedApi();

  if (!auth.authorized) {
    return auth.response;
  }

  const {
    conversationId,
  } = await params;

  const url =
    new URL(request.url);

  const before =
    url.searchParams
      .get("before")
      ?.trim() ?? "";

  if (
    !conversationId ||
    !before
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "INVALID_CURSOR",
      },
      {
        status: 400,
      },
    );
  }

  const membership =
    await prisma.chatParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId:
            auth.user.id,
        },
      },

      select: {
        conversation: {
          select: {
            type: true,
          },
        },
      },
    });

  if (!membership) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "CONVERSATION_NOT_FOUND",
      },
      {
        status: 404,
      },
    );
  }

  const cursorMessage =
    await prisma.chatMessage.findFirst({
      where: {
        id: before,
        conversationId,
      },

      select: {
        id: true,
        createdAt: true,
      },
    });

  if (!cursorMessage) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "INVALID_CURSOR",
      },
      {
        status: 400,
      },
    );
  }

  const limit =
    parseLimit(request);

  const rawMessages =
    await prisma.chatMessage.findMany({
      where: {
        conversationId,

        OR: [
          {
            createdAt: {
              lt:
                cursorMessage
                  .createdAt,
            },
          },
          {
            createdAt:
              cursorMessage
                .createdAt,

            id: {
              lt:
                cursorMessage.id,
            },
          },
        ],
      },

      take:
        limit + 1,

      orderBy: [
        {
          createdAt:
            "desc",
        },
        {
          id: "desc",
        },
      ],

      include: {
        sender: {
          select: {
            id: true,
            name: true,
            avatarStoredName: true,
            avatarUpdatedAt: true,
          },
        },

        receipts: {
          select: {
            userId: true,
            deliveredAt: true,
            readAt: true,
          },
        },

        attachments: {
          select: {
            id: true,
            originalName: true,
            mime: true,
            size: true,
          },
        },

        pollVotes: {
          select: {
            userId: true,
            optionIndex: true,
          },
        },

        replyTo: {
          select: {
            id: true,
            body: true,

            sender: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

  const hasMore =
    rawMessages.length >
    limit;

  const pageMessages =
    rawMessages
      .slice(0, limit)
      .reverse();

  const isGroup =
    membership
      .conversation
      .type === "GROUP";

  const items =
    pageMessages.map(
      (message) => {
        const mine =
          message.senderId ===
          auth.user.id;

        const otherReceipts =
          message.receipts.filter(
            (receipt) =>
              receipt.userId !==
              auth.user.id,
          );

        let deliveryState:
          | "SENT"
          | "DELIVERED"
          | "READ"
          | null = null;

        if (mine) {
          if (isGroup) {
            deliveryState =
              otherReceipts.length &&
              otherReceipts.every(
                (receipt) =>
                  Boolean(
                    receipt.readAt,
                  ),
              )
                ? "READ"
                : otherReceipts.length &&
                    otherReceipts.every(
                      (receipt) =>
                        Boolean(
                          receipt.deliveredAt,
                        ),
                    )
                  ? "DELIVERED"
                  : "SENT";
          } else {
            const receipt =
              otherReceipts[0] ??
              null;

            deliveryState =
              receipt?.readAt
                ? "READ"
                : receipt?.deliveredAt
                  ? "DELIVERED"
                  : "SENT";
          }
        }

        const imageOnly =
          message.body ===
            "صورة" &&
          message.attachments.some(
            (attachment) =>
              /^image\/(jpeg|png|gif|webp)$/i.test(
                attachment.mime,
              ),
          );

        return {
          id: message.id,
          body: message.body,
          kind: message.kind,
          isPinned:
            message.isPinned,

          attachments:
            message.attachments,

          pollQuestion:
            message.pollQuestion,

          pollOptions:
            message.pollOptions,

          pollVotes:
            message.pollVotes,

          replyTo:
            message.replyTo,

          imageOnly,
          mine,

          senderId:
            message.sender.id,

          senderName:
            message.sender.name,

          senderHasAvatar:
            Boolean(
              message.sender
                .avatarStoredName,
            ),

          senderAvatarVersion:
            message.sender
              .avatarUpdatedAt
              ?.getTime() ?? 0,

          createdAt:
            message.createdAt
              .toISOString(),

          deliveryState,
        };
      },
    );

  return privateNoStoreJson({
    ok: true,
    items,
    hasMore,

    nextCursor:
      items[0]?.id ??
      null,
  });
}
