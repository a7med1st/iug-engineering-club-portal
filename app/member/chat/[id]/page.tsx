import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  ExternalLink,
  Pin,
} from "lucide-react";
import PinnedMessageJumpButton from "@/components/member/PinnedMessageJumpButton";
import ChatComposer from "@/components/member/ChatComposer";
import ChatConversationView from "@/components/member/ChatConversationView";
import ChatMessageList from "@/components/member/ChatMessageList";
import ChatPresenceStatus from "@/components/member/ChatPresenceStatus";

import {
  PERMISSIONS,
  requirePermission,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

import styles from "../chat.module.css";

export const dynamic = "force-dynamic";


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
              take: 121,
              orderBy: [
                {
                  createdAt: "desc",
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

  const partner =
    conversation.participants.find(
      (item) => item.userId !== user.id,
    )?.user ?? null;

  if (!partner) {
    redirect("/member/chat");
  }

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

        const receipt = mine
          ? message.receipts[0] ??
            null
          : null;

        const deliveryState:
          | "SENT"
          | "DELIVERED"
          | "READ"
          | null =
          !mine
            ? null
            : receipt?.readAt
              ? "READ"
              : receipt?.deliveredAt
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
            false,

          senderAvatarVersion:
            0,

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
              src={`/members/${partner.id
                }/avatar?v=${partner.avatarUpdatedAt?.getTime() ??
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

      {pinnedMessage && (
        <div
          className={styles.pinnedMessageBar}
        >
          <span
            className={
              styles.pinnedMessageIcon
            }
          >
            <Pin
              size={17}
              aria-hidden="true"
            />
          </span>

          <span
            className={
              styles.pinnedMessageContent
            }
          >
            <strong>
              رسالة مثبتة
            </strong>

            <small>
              {pinnedMessage.sender.name}
            </small>

            <p>
              {pinnedMessage.body.length >
                100
                ? `${pinnedMessage.body.slice(
                  0,
                  100,
                )}...`
                : pinnedMessage.body}
            </p>
          </span>

          <PinnedMessageJumpButton
            messageId={
              pinnedMessage.id
            }
            className={
              styles.pinnedMessageView
            }
          />
        </div>
      )}

      <ChatConversationView
        conversationId={id}
        lastMessageId={
          lastMessageId
        }
      >
        <ChatMessageList
          mode="direct"
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

      <ChatComposer
        conversationId={id}
        className={
          styles.composer
        }
      />
    </section>
  );
}