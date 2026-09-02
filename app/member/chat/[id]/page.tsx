import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Check,
  CheckCheck,
  ExternalLink,
  MessagesSquare,
} from "lucide-react";

import ChatComposer from "@/components/member/ChatComposer";
import ChatConversationView from "@/components/member/ChatConversationView";
import ChatMessageContent from "@/components/member/ChatMessageContent";
import ChatPresenceStatus from "@/components/member/ChatPresenceStatus";

import {
  PERMISSIONS,
  requirePermission,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

import styles from "../chat.module.css";

export const dynamic = "force-dynamic";

function formatMessageTime(date: Date) {
  return new Intl.DateTimeFormat("ar-PS", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatMessageDay(date: Date) {
  return new Intl.DateTimeFormat("ar-PS", {
    dateStyle: "medium",
  }).format(date);
}

export default async function ConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { user } = await requirePermission(
    PERMISSIONS.MEMBER_DASHBOARD,
  );

  const { id } = await params;
  const feedback = await searchParams;

  const membership =
    await prisma.chatParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId: id,
          userId: user.id,
        },
      },

      include: {
        conversation: {
          include: {
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    role: true,
                    avatarStoredName: true,
                    avatarUpdatedAt: true,
                    chatLastSeenAt: true,

                    department: {
                      select: {
                        nameAr: true,
                      },
                    },

                    structureItem: {
                      select: {
                        title: true,
                      },
                    },
                  },
                },
              },
            },

            messages: {
              take: 120,
              orderBy: {
                createdAt: "asc",
              },

              include: {
                sender: {
                  select: {
                    id: true,
                    name: true,
                  },
                },

                receipts: {
                  where: {
                    userId: {
                      not: user.id,
                    },
                  },

                  select: {
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
              },
            },
          },
        },
      },
    });

  if (!membership) {
    redirect("/member/chat");
  }

  const conversation = membership.conversation;

  /*
   * حماية مهمة:
   * إذا كان الـ ID تابعًا لمجموعة وليس لمحادثة خاصة،
   * يتم تحويل المستخدم إلى رابط المجموعة الصحيح.
   */
  if (conversation.type !== "DIRECT") {
    redirect(
      `/member/chat/groups/${conversation.id}`,
    );
  }

  const partner =
    conversation.participants.find(
      (item) => item.userId !== user.id,
    )?.user ?? null;

  if (!partner) {
    redirect("/member/chat");
  }

  const messages = conversation.messages;

  let lastDay = "";

  const messageRows = messages.map((message) => {
    const day = formatMessageDay(
      message.createdAt,
    );

    const showDay = day !== lastDay;

    lastDay = day;

    const mine =
      message.senderId === user.id;

    const receipt = mine
      ? message.receipts[0] ?? null
      : null;

    const deliveryState = !mine
      ? null
      : receipt?.readAt
        ? "READ"
        : receipt?.deliveredAt
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
      body: message.body,
      kind: message.kind,
      attachments: message.attachments,

      pollQuestion:
        message.pollQuestion,

      pollOptions:
        message.pollOptions,

      pollVotes:
        message.pollVotes,

      imageOnly,

      mine,

      senderName:
        message.sender.name,

      time:
        formatMessageTime(
          message.createdAt,
        ),

      day:
        showDay
          ? day
          : null,

      deliveryState,
    };
  });

  const lastMessageId =
    messages.at(-1)?.id ?? "";

  return (
    <section
      className={styles.conversation}
    >
      <header
        className={
          styles.conversationHeader
        }
      >
        <div
          className={styles.partnerAvatar}
        >
          {partner.avatarStoredName ? (
            <img
              src={`/members/${
                partner.id
              }/avatar?v=${
                partner.avatarUpdatedAt?.getTime() ??
                0
              }`}
              alt=""
            />
          ) : (
            partner.name
              .trim()
              .charAt(0)
              .toUpperCase()
          )}
        </div>

        <div
          className={styles.partnerInfo}
        >
          <h1>
            {partner.name}
          </h1>

          <p>
            <ChatPresenceStatus
              conversationId={id}
              initialLastSeenAt={
                partner.chatLastSeenAt?.toISOString() ??
                null
              }
            />
          </p>
        </div>

        <Link
          href="/member/chat"
          className={
            styles.mobileChatBack
          }
          aria-label="العودة إلى قائمة المحادثات"
          title="العودة إلى المحادثات"
        >
          <ArrowRight
            aria-hidden="true"
          />
        </Link>

        {partner.structureItem && (
          <Link
            href={`/members/${partner.id}`}
            className={
              styles.profileLink
            }
          >
            <ExternalLink
              size={16}
            />

            الملف الشخصي
          </Link>
        )}
      </header>

      {feedback.error && (
        <div
          className={
            styles.feedbackError
          }
        >
          {feedback.error}
        </div>
      )}

      <ChatConversationView
        conversationId={id}
        lastMessageId={
          lastMessageId
        }
      >
        <div
          className={styles.messages}
        >
          {messageRows.length ? (
            messageRows.map(
              (message) => (
                <div
                  key={message.id}
                >
                  {message.day && (
                    <div
                      className={
                        styles.dayDivider
                      }
                    >
                      <span>
                        {message.day}
                      </span>
                    </div>
                  )}

                  <article
                    className={`${
                      message.mine
                        ? styles.messageMine
                        : styles.messageOther
                    } ${
                      message.attachments
                        .length
                        ? styles.messageWithAttachment
                        : ""
                    } ${
                      message.imageOnly
                        ? styles.messageImageOnly
                        : ""
                    }`}
                  >
                    {!message.mine && (
                      <small
                        className={
                          styles.senderName
                        }
                      >
                        {
                          message.senderName
                        }
                      </small>
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
                        styles.messageFooter
                      }
                    >
                      <time>
                        {
                          message.time
                        }
                      </time>

                      {message.mine &&
                        message.deliveryState ===
                          "SENT" && (
                          <Check
                            size={
                              15
                            }
                            className={
                              styles.deliverySent
                            }
                            aria-label="تم الإرسال"
                          />
                        )}

                      {message.mine &&
                        message.deliveryState ===
                          "DELIVERED" && (
                          <CheckCheck
                            size={
                              16
                            }
                            className={
                              styles.deliveryDelivered
                            }
                            aria-label="تم التسليم"
                          />
                        )}

                      {message.mine &&
                        message.deliveryState ===
                          "READ" && (
                          <CheckCheck
                            size={
                              16
                            }
                            className={
                              styles.deliveryRead
                            }
                            aria-label="تمت القراءة"
                          />
                        )}
                    </div>
                  </article>
                </div>
              ),
            )
          ) : (
            <div
              className={
                styles.noMessages
              }
            >
              <MessagesSquare
                size={30}
              />

              <strong>
                ابدأ المحادثة
              </strong>

              <span>
                أرسل أول رسالة إلى{" "}
                {partner.name}.
              </span>
            </div>
          )}

          <div
            id="chat-bottom"
            aria-hidden="true"
          />
        </div>
      </ChatConversationView>

      <ChatComposer
        conversationId={id}
        className={
          styles.composer
        }
      />
    </section>
  );
}