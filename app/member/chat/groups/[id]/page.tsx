import Link from "next/link";
import ReplyMessageJump from "@/components/member/ReplyMessageJump";
import { redirect } from "next/navigation";
import PinnedMessageJumpButton from "@/components/member/PinnedMessageJumpButton";
import {
  ArrowRight,
  Check,
  CheckCheck,
  Pin,
  UsersRound,
} from "lucide-react";
import GroupMessageContextMenu from "@/components/member/GroupMessageContextMenu";

import ChatComposer from "@/components/member/ChatComposer";
import ChatConversationView from "@/components/member/ChatConversationView";
import ChatGroupTypingStatus from "@/components/member/ChatGroupTypingStatus";
import ChatMessageContent from "@/components/member/ChatMessageContent";

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

const fmtTime = (date: Date) =>
  new Intl.DateTimeFormat("ar-PS", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

const fmtDay = (date: Date) =>
  new Intl.DateTimeFormat("ar-PS", {
    dateStyle: "medium",
  }).format(date);

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

  let lastDay = "";

  const rows =
    conversation.messages.map(
      (message) => {
        const day =
          fmtDay(
            message.createdAt,
          );

        const showDay =
          day !== lastDay;

        lastDay = day;

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

        const state =
          !mine
            ? null
            : receipts.length &&
              receipts.every(
                (receipt) =>
                  receipt.readAt,
              )
              ? "READ"
              : receipts.length &&
                receipts.every(
                  (receipt) =>
                    receipt.deliveredAt,
                )
                ? "DELIVERED"
                : "SENT";

        const imageOnly =
          message.body === "صورة" &&
          message.attachments.some(
            (attachment) =>
              /^image\/(jpeg|png|gif|webp)$/i.test(
                attachment.mime,
              ),
          );

        return {
          id: message.id,

          body:
            message.body,

          kind:
            message.kind,

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

          time:
            fmtTime(
              message.createdAt,
            ),

          day:
            showDay
              ? day
              : null,

          state,
        };
      },
    );

  const lastMessageId =
    conversation.messages.at(-1)
      ?.id ?? "";

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
<div
  className={chatStyles.messages}
  data-chat-messages="true"
>
            {rows.map(
              (message) => (
                <div
                  key={message.id}
                  id={`message-${message.id}`}
                  className={
                    message.isPinned
                      ? chatStyles.pinnedMessageTarget
                      : undefined
                  }
                >
                  {message.day && (
                    <div
                      className={
                        chatStyles.dayDivider
                      }
                    >
                      <span>
                        {
                          message.day
                        }
                      </span>
                    </div>
                  )}

                  <div
                    className={`${chatStyles.groupMessageRow} ${message.mine
                      ? chatStyles.groupMessageRowMine
                      : chatStyles.groupMessageRowOther
                      }`}
                  >
                    {!message.mine && (
                      <div
                        className={
                          chatStyles.groupMessageAvatar
                        }
                      >
                        {message.senderHasAvatar ? (
                          <img
                            src={`/members/${message.senderId}/avatar?v=${message.senderAvatarVersion}`}
                            alt=""
                          />
                        ) : (
                          <span>
                            {message.senderName
                              .trim()
                              .charAt(0)
                              .toUpperCase()}
                          </span>
                        )}
                      </div>
                    )}

                    <GroupMessageContextMenu
                      messageId={message.id}
                      senderName={message.senderName}
                      body={message.body}
                      isPinned={message.isPinned}
                      className={`${message.mine
                        ? chatStyles.messageMine
                        : chatStyles.messageOther
                        } ${message
                          .attachments
                          .length
                          ? chatStyles.messageWithAttachment
                          : ""
                        } ${message.imageOnly
                          ? chatStyles.messageImageOnly
                          : ""
                        }`}
                    >
                      {!message.mine && (
                        <small
                          className={
                            chatStyles.senderName
                          }
                        >
                          {
                            message.senderName
                          }
                        </small>
                      )}

                      {message.replyTo && (
  <ReplyMessageJump
    messageId={
      message.replyTo.id
    }
className={
  chatStyles.replyContext
}
  >
    <strong>
      {
        message.replyTo
          .sender.name
      }
    </strong>

    <span>
      {message.replyTo.body}
    </span>
  </ReplyMessageJump>
)}

                      <ChatMessageContent
                        messageId={
                          message.id
                        }
                        kind={
                          message.kind
                        }
                        body={
                          message.body
                        }
                        attachments={
                          message.attachments
                        }
                        pollQuestion={
                          message.pollQuestion
                        }
                        pollOptions={
                          message.pollOptions
                        }
                        pollVotes={
                          message.pollVotes
                        }
                        currentUserId={
                          user.id
                        }
                      />

                      <div
                        className={
                          chatStyles.messageFooter
                        }
                      >
                        <time>
                          {message.time}
                        </time>

                        {message.mine &&
                          message.state === "SENT" && (
                            <Check
                              size={15}
                              className={
                                chatStyles.deliverySent
                              }
                              aria-label="تم الإرسال"
                            />
                          )}

                        {message.mine &&
                          message.state === "DELIVERED" && (
                            <CheckCheck
                              size={16}
                              className={
                                chatStyles.deliveryDelivered
                              }
                              aria-label="تم التسليم"
                            />
                          )}

                        {message.mine &&
                          message.state === "READ" && (
                            <CheckCheck
                              size={16}
                              className={
                                chatStyles.deliveryRead
                              }
                              aria-label="تمت القراءة"
                            />
                          )}
                      </div>
                    </GroupMessageContextMenu>

                  </div>
                </div>
              ),
            )}

            <div
              id="chat-bottom"
              aria-hidden="true"
            />
          </div>
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