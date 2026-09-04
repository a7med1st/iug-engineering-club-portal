"use client";

import {
  Check,
  CheckCheck,
} from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import DirectMessageContextMenu from "@/components/member/DirectMessageContextMenu";
import GroupMessageContextMenu from "@/components/member/GroupMessageContextMenu";
import ReplyMessageJump from "@/components/member/ReplyMessageJump";
import ChatMessageContent from "@/components/member/ChatMessageContent";

import chatStyles from "@/app/member/chat/chat.module.css";

export type ChatHistoryMessage = {
  id: string;
  body: string;
  kind: string;
  isPinned: boolean;

  attachments: {
    id: string;
    originalName: string;
    mime: string;
    size: number;
  }[];

  pollQuestion: string | null;
  pollOptions: string[];

  pollVotes: {
    userId: string;
    optionIndex: number;
  }[];

  replyTo: {
    id: string;
    body: string;
    sender: {
      name: string;
    };
  } | null;

  imageOnly: boolean;
  mine: boolean;

  senderId: string;
  senderName: string;
  senderHasAvatar: boolean;
  senderAvatarVersion: number;

  createdAt: string;

  deliveryState:
    | "SENT"
    | "DELIVERED"
    | "READ"
    | null;
};

type HistoryPayload = {
  ok: boolean;
  items: ChatHistoryMessage[];
  hasMore: boolean;
  nextCursor: string | null;
};

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat(
    "ar-PS",
    {
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(new Date(value));
}

function formatMessageDay(value: string) {
  return new Intl.DateTimeFormat(
    "ar-PS",
    {
      dateStyle: "medium",
    },
  ).format(new Date(value));
}

function compareMessages(
  first: ChatHistoryMessage,
  second: ChatHistoryMessage,
) {
  const timeDiff =
    new Date(first.createdAt).getTime() -
    new Date(second.createdAt).getTime();

  if (timeDiff !== 0) {
    return timeDiff;
  }

  return first.id.localeCompare(
    second.id,
  );
}

export default function ChatMessageList({
  mode,
  conversationId,
  currentUserId,
  initialMessages,
  initialHasMore,
}: {
  mode: "direct" | "group";
  conversationId: string;
  currentUserId: string;
  initialMessages: ChatHistoryMessage[];
  initialHasMore: boolean;
}) {
  const [messages, setMessages] =
    useState<ChatHistoryMessage[]>(
      initialMessages,
    );

  const [hasMore, setHasMore] =
    useState(initialHasMore);

  const [cursor, setCursor] =
    useState<string | null>(
      initialMessages[0]?.id ?? null,
    );

  const [loadingOlder, setLoadingOlder] =
    useState(false);

  const [loadError, setLoadError] =
    useState<string | null>(null);

  const containerRef =
    useRef<HTMLDivElement>(null);

  const historyLoadedRef =
    useRef(false);

  const restoreScrollRef =
    useRef<{
      previousHeight: number;
      previousTop: number;
    } | null>(null);

  /*
   * router.refresh() keeps bringing the newest messages
   * from the Server Component.
   *
   * Merge them into the already loaded history so older
   * batches never disappear while the chat is open.
   */
  useEffect(() => {
    setMessages((current) => {
      const byId =
        new Map<
          string,
          ChatHistoryMessage
        >();

      for (const message of current) {
        byId.set(
          message.id,
          message,
        );
      }

      for (
        const message
        of initialMessages
      ) {
        byId.set(
          message.id,
          message,
        );
      }

      return Array.from(
        byId.values(),
      ).sort(compareMessages);
    });

    if (!historyLoadedRef.current) {
      setHasMore(initialHasMore);

      setCursor(
        initialMessages[0]?.id ??
          null,
      );
    }
  }, [
    initialHasMore,
    initialMessages,
  ]);

  /*
   * When older rows are prepended, keep the same visible
   * message in almost the same place instead of jumping.
   */
  useLayoutEffect(() => {
    const restore =
      restoreScrollRef.current;

    const container =
      containerRef.current;

    if (
      !restore ||
      !container
    ) {
      return;
    }

    const heightDifference =
      container.scrollHeight -
      restore.previousHeight;

    container.scrollTop =
      restore.previousTop +
      heightDifference;

    restoreScrollRef.current =
      null;
  }, [messages]);

  async function loadOlderMessages() {
    if (
      !hasMore ||
      !cursor ||
      loadingOlder
    ) {
      return;
    }

    const container =
      containerRef.current;

    if (!container) {
      return;
    }

    setLoadingOlder(true);
    setLoadError(null);

    try {
      const response =
        await fetch(
          `/api/chat/${encodeURIComponent(
            conversationId,
          )}/history?before=${encodeURIComponent(
            cursor,
          )}&limit=120`,
          {
            cache: "no-store",
          },
        );

      if (!response.ok) {
        throw new Error(
          "LOAD_FAILED",
        );
      }

      const data =
        (await response.json()) as
          HistoryPayload;

      restoreScrollRef.current = {
        previousHeight:
          container.scrollHeight,
        previousTop:
          container.scrollTop,
      };

      historyLoadedRef.current =
        true;

      setMessages(
        (current) => {
          const byId =
            new Map<
              string,
              ChatHistoryMessage
            >();

          for (
            const message
            of data.items
          ) {
            byId.set(
              message.id,
              message,
            );
          }

          for (
            const message
            of current
          ) {
            byId.set(
              message.id,
              message,
            );
          }

          return Array.from(
            byId.values(),
          ).sort(
            compareMessages,
          );
        },
      );

      setHasMore(
        data.hasMore,
      );

      if (data.nextCursor) {
        setCursor(
          data.nextCursor,
        );
      }
    } catch {
      restoreScrollRef.current =
        null;

      setLoadError(
        "تعذر تحميل الرسائل السابقة. حاول مرة أخرى.",
      );
    } finally {
      setLoadingOlder(false);
    }
  }

  let lastDay = "";

  return (
    <div
      ref={containerRef}
      className={
        chatStyles.messages
      }
      data-chat-messages="true"
    >
      {hasMore && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding:
              "8px 12px 14px",
          }}
        >
          <button
            type="button"
            className="ghost-btn"
            disabled={loadingOlder}
            onClick={() =>
              void loadOlderMessages()
            }
          >
            {loadingOlder
              ? "جار تحميل الرسائل السابقة..."
              : "تحميل الرسائل السابقة"}
          </button>
        </div>
      )}

      {loadError && (
        <div
          role="alert"
          style={{
            textAlign: "center",
            padding:
              "0 12px 12px",
          }}
        >
          <small>
            {loadError}
          </small>
        </div>
      )}

      {messages.map(
        (message) => {
          const day =
            formatMessageDay(
              message.createdAt,
            );

          const showDay =
            day !== lastDay;

          lastDay = day;

          const bubble = (
            <ComponentMessageBubble
              mode={mode}
              message={message}
              currentUserId={
                currentUserId
              }
            />
          );

          return (
            <div
              key={message.id}
              id={`message-${message.id}`}
              className={
                message.isPinned
                  ? chatStyles.pinnedMessageTarget
                  : undefined
              }
            >
              {showDay && (
                <div
                  className={
                    chatStyles.dayDivider
                  }
                >
                  <span>
                    {day}
                  </span>
                </div>
              )}

              {mode ===
              "group" ? (
                <div
                  className={`${chatStyles.groupMessageRow} ${
                    message.mine
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

                  {bubble}
                </div>
              ) : (
                bubble
              )}
            </div>
          );
        },
      )}

      <div
        id="chat-bottom"
        aria-hidden="true"
      />
    </div>
  );
}

function ComponentMessageBubble({
  mode,
  message,
  currentUserId,
}: {
  mode: "direct" | "group";
  message: ChatHistoryMessage;
  currentUserId: string;
}) {
  const className = `${
    message.mine
      ? chatStyles.messageMine
      : chatStyles.messageOther
  } ${
    message.attachments.length
      ? chatStyles.messageWithAttachment
      : ""
  } ${
    message.imageOnly
      ? chatStyles.messageImageOnly
      : ""
  }`;

  const content = (
    <>
      {!message.mine && (
        <small
          className={
            chatStyles.senderName
          }
        >
          {message.senderName}
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
        messageId={message.id}
        kind={message.kind}
        body={message.body}
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
          currentUserId
        }
      />

      <div
        className={
          chatStyles.messageFooter
        }
      >
        <time>
          {formatMessageTime(
            message.createdAt,
          )}
        </time>

        {message.mine &&
          message.deliveryState ===
            "SENT" && (
            <Check
              size={15}
              className={
                chatStyles.deliverySent
              }
              aria-label="تم الإرسال"
            />
          )}

        {message.mine &&
          message.deliveryState ===
            "DELIVERED" && (
            <CheckCheck
              size={16}
              className={
                chatStyles.deliveryDelivered
              }
              aria-label="تم التسليم"
            />
          )}

        {message.mine &&
          message.deliveryState ===
            "READ" && (
            <CheckCheck
              size={16}
              className={
                chatStyles.deliveryRead
              }
              aria-label="تمت القراءة"
            />
          )}
      </div>
    </>
  );

  if (mode === "group") {
    return (
      <GroupMessageContextMenu
        messageId={message.id}
        senderName={
          message.senderName
        }
        body={message.body}
        isPinned={
          message.isPinned
        }
        isMine={message.mine}
        canEdit={
          message.mine &&
          message.kind ===
            "TEXT" &&
          message.attachments
            .length === 0
        }
        className={className}
      >
        {content}
      </GroupMessageContextMenu>
    );
  }

  return (
    <DirectMessageContextMenu
      messageId={message.id}
      senderName={
        message.senderName
      }
      body={message.body}
      isPinned={
        message.isPinned
      }
      isMine={message.mine}
      canEdit={
        message.mine &&
        message.kind ===
          "TEXT" &&
        message.attachments
          .length === 0
      }
      className={className}
    >
      {content}
    </DirectMessageContextMenu>
  );
}
