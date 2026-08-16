import Link from "next/link";
import {
  redirect,
} from "next/navigation";

import {
  ExternalLink,
  MessagesSquare,
  Send,
} from "lucide-react";

import ChatConversationView from "@/components/member/ChatConversationView";

import {
  PERMISSIONS,
  requirePermission,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

import { sendChatMessage } from "../actions";
import styles from "../chat.module.css";

export const dynamic =
  "force-dynamic";

function formatMessageTime(
  date: Date,
) {
  return new Intl.DateTimeFormat(
    "ar-PS",
    {
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(date);
}

function formatMessageDay(
  date: Date,
) {
  return new Intl.DateTimeFormat(
    "ar-PS",
    {
      dateStyle: "medium",
    },
  ).format(date);
}

export default async function ConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{
    id: string;
  }>;

  searchParams: Promise<{
    error?: string;
  }>;
}) {
  const { user } =
    await requirePermission(
      PERMISSIONS.MEMBER_DASHBOARD,
    );

  const { id } =
    await params;

  const feedback =
    await searchParams;

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
              },
            },
          },
        },
      },
    });

  if (!membership) {
    redirect("/member/chat");
  }

  const conversation =
    membership.conversation;

  const partner =
    conversation.participants.find(
      (item) =>
        item.userId !== user.id,
    )?.user ?? null;

  if (!partner) {
    redirect("/member/chat");
  }

  const messages =
    conversation.messages;

  let lastDay = "";

  const messageRows =
    messages.map((message) => {
      const day =
        formatMessageDay(
          message.createdAt,
        );

      const showDay =
        day !== lastDay;

      lastDay = day;

      return {
        id: message.id,
        body: message.body,
        mine:
          message.senderId ===
          user.id,
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
      };
    });

  const lastMessageId =
    messages.at(-1)?.id ??
    "";

  return (
    <section className={styles.conversation}>
      <header className={styles.conversationHeader}>
        <div className={styles.partnerAvatar}>
          {partner.avatarStoredName ? (
            <img
              src={`/members/${partner.id}/avatar?v=${partner.avatarUpdatedAt?.getTime() ?? 0}`}
              alt=""
            />
          ) : (
            partner.name
              .trim()
              .charAt(0)
              .toUpperCase()
          )}
        </div>

        <div className={styles.partnerInfo}>
          <h1>{partner.name}</h1>

          <p>
            {partner.structureItem
              ?.title ??
              (partner.role ===
              "ADMIN"
                ? "إدارة النادي"
                : "عضو")}

            {partner.department
              ?.nameAr
              ? ` · ${partner.department.nameAr}`
              : ""}
          </p>
        </div>

        {partner.structureItem && (
          <Link
            href={`/members/${partner.id}`}
            className={styles.profileLink}
          >
            <ExternalLink
              size={16}
            />
            الملف الشخصي
          </Link>
        )}
      </header>

      {feedback.error && (
        <div className={styles.feedbackError}>
          {feedback.error}
        </div>
      )}

      <ChatConversationView
        conversationId={id}
        lastMessageId={
          lastMessageId
        }
      >
        <div className={styles.messages}>
          {messageRows.length ? (
            messageRows.map(
              (message) => (
                <div
                  key={message.id}
                >
                  {message.day && (
                    <div className={styles.dayDivider}>
                      <span>
                        {message.day}
                      </span>
                    </div>
                  )}

                  <article
                    className={
                      message.mine
                        ? styles.messageMine
                        : styles.messageOther
                    }
                  >
                    {!message.mine && (
                      <small className={styles.senderName}>
                        {message.senderName}
                      </small>
                    )}

                    <p>
                      {message.body}
                    </p>

                    <time>
                      {message.time}
                    </time>
                  </article>
                </div>
              ),
            )
          ) : (
            <div className={styles.noMessages}>
              <MessagesSquare
                size={30}
              />

              <strong>
                ابدأ المحادثة
              </strong>

              <span>
                أرسل أول رسالة إلى {partner.name}.
              </span>
            </div>
          )}

          <div
            id="chat-bottom"
            aria-hidden="true"
          />
        </div>
      </ChatConversationView>

      <form
        action={sendChatMessage}
        className={styles.composer}
      >
        <input
          type="hidden"
          name="conversationId"
          value={id}
        />

        <textarea
          name="body"
          rows={1}
          maxLength={3000}
          placeholder="اكتب رسالتك..."
          required
        />

        <button
          type="submit"
          aria-label="إرسال الرسالة"
          title="إرسال"
        >
          <Send
            aria-hidden="true"
          />
        </button>
      </form>
    </section>
  );
}