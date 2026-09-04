import Link from "next/link";
import { redirect } from "next/navigation";
import PinnedMessageJumpButton from "@/components/member/PinnedMessageJumpButton";
import {
  ArrowRight,
  Pin,
  UsersRound,
} from "lucide-react";

import ChatComposer from "@/components/member/ChatComposer";
import ChatConversationView from "@/components/member/ChatConversationView";
import ChatMessageList from "@/components/member/ChatMessageList";
import ChatGroupTypingStatus from "@/components/member/ChatGroupTypingStatus";

import {
  PERMISSIONS,
  requirePermission,
} from "@/lib/permissions";

import {
  getSystemGroupMembership,
} from "@/lib/chat-groups";

import { prisma } from "@/lib/prisma";

import chatStyles from "../../chat.module.css";
import styles from "../groups.module.css";

export const dynamic = "force-dynamic";


export default async function GroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await requirePermission(
    PERMISSIONS.MEMBER_DASHBOARD,
  );

  const { id } = await params;

  const membership =
    await getSystemGroupMembership(
      user.id,
      id,
    );

  if (!membership) {
    redirect("/member/chat/groups");
  }

  const conversation =
    membership.conversation;

  const pinnedMessage =
    await prisma.chatMessage.findFirst({
      where: {
        conversationId: id,
        isPinned: true,
      },

      select: {
        id: true,
        body: true,

        sender: {
          select: {
            name: true,
          },
        },
      },

      orderBy: {
        pinnedAt: "desc",
      },
    });

  const hasOlderMessages =
    conversation.messages.length >
    120;

  const messages =
    conversation.messages
      .slice(0, 120)
      .reverse();

  const initialMessages =
    messages.map(
      (message) => {
        const mine =
          message.senderId ===
          user.id;

        const receipts =
          mine
            ? message.receipts.filter(
                (receipt) =>
                  receipt.userId !==
                  user.id,
              )
            : [];

        const deliveryState:
          | "SENT"
          | "DELIVERED"
          | "READ"
          | null =
          !mine
            ? null
            : receipts.length &&
                receipts.every(
                  (receipt) =>
                    Boolean(
                      receipt.readAt,
                    ),
                )
              ? "READ"
              : receipts.length &&
                  receipts.every(
                    (receipt) =>
                      Boolean(
                        receipt.deliveredAt,
                      ),
                  )
                ? "DELIVERED"
                : "SENT";

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

  const lastMessageId =
    messages.at(-1)?.id ??
    "";

  return (
    <main
      className={
        styles.conversationPage
      }
    >
      <section
        className={
          chatStyles.conversation
        }
      >
        {/* =========================
            GROUP HEADER
        ========================== */}

        <header
          className={
            chatStyles.conversationHeader
          }
        >
          <div
            className={
              chatStyles.partnerAvatar
            }
          >
            <UsersRound />
          </div>

          <div
            className={
              chatStyles.partnerInfo
            }
          >
            <h1>
              {conversation.name ??
                "مجموعة"}
            </h1>

            <p>
              <ChatGroupTypingStatus
                conversationId={id}
                participantCount={
                  conversation
                    .participants
                    .length
                }
              />
            </p>
          </div>

          <Link
            href="/member/chat"
            className={
              chatStyles.mobileChatBack
            }
            aria-label="العودة إلى قائمة المحادثات"
            title="العودة إلى المحادثات"
          >
            <ArrowRight
              aria-hidden="true"
            />
          </Link>
        </header>

        {/* =========================
            PINNED MESSAGE
            مهم: خارج الـ header
        ========================== */}

        {pinnedMessage && (
          <div
            className={chatStyles.pinnedMessageBar}
          >
            <span
              className={
                chatStyles.pinnedMessageIcon
              }
            >
              <Pin
                size={17}
                aria-hidden="true"
              />
            </span>

            <span
              className={
                chatStyles.pinnedMessageContent
              }
            >
              <strong>
                رسالة مثبتة
              </strong>

              <small>
                {
                  pinnedMessage
                    .sender.name
                }
              </small>

              <p>
                {pinnedMessage.body
                  .length > 100
                  ? `${pinnedMessage.body.slice(
                    0,
                    100,
                  )}...`
                  : pinnedMessage.body}
              </p>
            </span>

            <PinnedMessageJumpButton
              messageId={pinnedMessage.id}
              className={
                chatStyles.pinnedMessageView
              }
            />
          </div>
        )}

        {/* =========================
            MESSAGES
        ========================== */}

        <ChatConversationView
          conversationId={id}
          lastMessageId={
            lastMessageId
          }
        >
          <ChatMessageList
            mode="group"
            conversationId={id}
            currentUserId={
              user.id
            }
            initialMessages={
              initialMessages
            }
            initialHasMore={
              hasOlderMessages
            }
          />
        </ChatConversationView>

        {/* =========================
            COMPOSER
        ========================== */}

        <ChatComposer
          conversationId={id}
          className={
            chatStyles.composer
          }
        />
      </section>
    </main>
  );
}