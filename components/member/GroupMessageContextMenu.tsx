"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";

import {
  createPortal,
} from "react-dom";

import {
  Copy,
  Pencil,
  Pin,
  PinOff,
  Reply,
  Trash2,
} from "lucide-react";

import {
  deleteChatMessageForEveryone,
  editChatMessage,
  togglePinnedGroupMessage,
} from "@/app/member/chat/actions";

import ChatMessageActionModal from "@/components/member/ChatMessageActionModal";

import styles from "@/app/member/chat/chat.module.css";

type Props = {
  messageId: string;
  senderName: string;
  body: string;
  isPinned: boolean;
  isMine: boolean;
  canEdit: boolean;
  className?: string;
  children: React.ReactNode;
};

type MenuPosition = {
  x: number;
  y: number;
};

export default function GroupMessageContextMenu({
  messageId,
  senderName,
  body,
  isPinned,
  isMine,
  canEdit,
  className,
  children,
}: Props) {
  const [menu, setMenu] =
    useState<MenuPosition | null>(null);

  const [swipeX, setSwipeX] =
    useState(0);

  const [isPending, startTransition] =
    useTransition();

  const [actionModal, setActionModal] =
    useState<"edit" | "delete" | null>(null);

  const [editBody, setEditBody] =
    useState(body);

  const pointerStart =
    useRef({
      x: 0,
      y: 0,
    });

  const activePointerId =
    useRef<number | null>(null);

  const swipeXRef =
    useRef(0);

  const isSwiping =
    useRef(false);

  const lastPointerType =
    useRef("");

  const closeMenu = () => {
    setMenu(null);
  };

  const openMenu = (
    x: number,
    y: number,
  ) => {
    const menuWidth = 215;

    const menuHeight =
      isMine
        ? canEdit
          ? 265
          : 220
        : 155;

    setMenu({
      x: Math.max(
        8,
        Math.min(
          x,
          window.innerWidth -
            menuWidth -
            8,
        ),
      ),

      y: Math.max(
        8,
        Math.min(
          y,
          window.innerHeight -
            menuHeight -
            8,
        ),
      ),
    });
  };

  /* =========================
     REPLY
  ========================= */

  const handleReply = () => {
    window.dispatchEvent(
      new CustomEvent(
        "chat-reply-selected",
        {
          detail: {
            messageId,
            senderName,
            body,
          },
        },
      ),
    );

    closeMenu();
  };

  /* =========================
     COPY
  ========================= */

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(
        body,
      );
    } catch {
      const textarea =
        document.createElement(
          "textarea",
        );

      textarea.value = body;
      textarea.style.position =
        "fixed";
      textarea.style.opacity =
        "0";

      document.body.appendChild(
        textarea,
      );

      textarea.select();

      document.execCommand(
        "copy",
      );

      textarea.remove();
    }

    closeMenu();
  };

  /* =========================
     EDIT
  ========================= */

  const handleEdit = () => {
    if (
      !isMine ||
      !canEdit ||
      isPending
    ) {
      return;
    }

    setEditBody(body);
    closeMenu();
    setActionModal("edit");
  };

  const confirmEdit = () => {
    const normalized =
      editBody.trim();

    if (!normalized) {
      return;
    }

    if (normalized === body) {
      setActionModal(null);
      return;
    }

    const formData =
      new FormData();

    formData.set(
      "messageId",
      messageId,
    );

    formData.set(
      "body",
      normalized,
    );

    startTransition(
      async () => {
        try {
          await editChatMessage(
            formData,
          );
        } finally {
          setActionModal(null);
        }
      },
    );
  };

  /* =========================
     DELETE FOR EVERYONE
  ========================= */

  const handleDelete = () => {
    if (
      !isMine ||
      isPending
    ) {
      return;
    }

    closeMenu();
    setActionModal("delete");
  };

  const confirmDelete = () => {
    if (isPending) {
      return;
    }

    const formData =
      new FormData();

    formData.set(
      "messageId",
      messageId,
    );

    startTransition(
      async () => {
        try {
          await deleteChatMessageForEveryone(
            formData,
          );
        } finally {
          setActionModal(null);
        }
      },
    );
  };

  /* =========================
     SWIPE TO REPLY
  ========================= */

  const resetSwipe = () => {
    swipeXRef.current = 0;
    isSwiping.current = false;
    activePointerId.current = null;

    setSwipeX(0);
  };

  const isInteractiveTarget = (
    target: EventTarget | null,
  ) => {
    if (
      !(
        target instanceof
        HTMLElement
      )
    ) {
      return false;
    }

    return Boolean(
      target.closest(
        "a, button, input, textarea, select, label, audio, video",
      ),
    );
  };

  useEffect(() => {
    if (!menu) {
      return;
    }

    const handleEscape = (
      event: KeyboardEvent,
    ) => {
      if (
        event.key ===
        "Escape"
      ) {
        closeMenu();
      }
    };

    const handleScroll = () => {
      closeMenu();
    };

    document.addEventListener(
      "keydown",
      handleEscape,
    );

    window.addEventListener(
      "scroll",
      handleScroll,
      true,
    );

    return () => {
      document.removeEventListener(
        "keydown",
        handleEscape,
      );

      window.removeEventListener(
        "scroll",
        handleScroll,
        true,
      );
    };
  }, [menu]);

  return (
    <>
      <article
        className={`${className ?? ""} ${
          styles.messageSwipeSurface
        }`}
        style={{
          transform:
            swipeX !== 0
              ? `translate3d(${swipeX}px, 0, 0)`
              : undefined,

          transition:
            isSwiping.current
              ? "none"
              : "transform 180ms cubic-bezier(.2,.8,.2,1)",
        }}
        onContextMenu={(
          event,
        ) => {
          event.preventDefault();

          if (
            lastPointerType.current ===
              "touch" ||
            lastPointerType.current ===
              "pen"
          ) {
            return;
          }

          openMenu(
            event.clientX,
            event.clientY,
          );
        }}
        onPointerDown={(
          event,
        ) => {
          lastPointerType.current =
            event.pointerType;

          if (
            event.button !== 0
          ) {
            return;
          }

          if (
            isInteractiveTarget(
              event.target,
            )
          ) {
            return;
          }

          activePointerId.current =
            event.pointerId;

          pointerStart.current = {
            x: event.clientX,
            y: event.clientY,
          };

          swipeXRef.current = 0;
          isSwiping.current = false;

          try {
            event.currentTarget
              .setPointerCapture(
                event.pointerId,
              );
          } catch {}
        }}
        onPointerMove={(
          event,
        ) => {
          if (
            activePointerId.current !==
            event.pointerId
          ) {
            return;
          }

          const diffX =
            event.clientX -
            pointerStart.current.x;

          const diffY =
            event.clientY -
            pointerStart.current.y;

          if (
            Math.abs(diffY) >
              Math.abs(diffX) &&
            Math.abs(diffY) > 8
          ) {
            resetSwipe();
            return;
          }

          /*
           * رسالتي:
           * السحب لليمين للرد.
           *
           * رسالة الطرف الآخر:
           * السحب لليسار للرد.
           */
          if (isMine) {
            if (diffX <= 5) {
              return;
            }

            isSwiping.current = true;

            const nextX =
              Math.min(
                diffX,
                90,
              );

            swipeXRef.current =
              nextX;

            setSwipeX(
              nextX,
            );
          } else {
            if (diffX >= -5) {
              return;
            }

            isSwiping.current = true;

            const nextX =
              Math.max(
                diffX,
                -90,
              );

            swipeXRef.current =
              nextX;

            setSwipeX(
              nextX,
            );
          }
        }}
        onPointerUp={(
          event,
        ) => {
          const shouldReply =
            isSwiping.current &&
            Math.abs(
              swipeXRef.current,
            ) >= 55;

          try {
            if (
              event.currentTarget
                .hasPointerCapture(
                  event.pointerId,
                )
            ) {
              event.currentTarget
                .releasePointerCapture(
                  event.pointerId,
                );
            }
          } catch {}

          resetSwipe();

          if (
            shouldReply
          ) {
            handleReply();

            if (
              "vibrate" in
              navigator
            ) {
              navigator.vibrate(
                20,
              );
            }
          }
        }}
        onPointerCancel={() => {
          resetSwipe();
        }}
      >
        {children}
      </article>

      {menu &&
        createPortal(
          <>
            <button
              type="button"
              className={
                styles.contextMenuBackdrop
              }
              onClick={
                closeMenu
              }
              aria-label="إغلاق القائمة"
            />

            <div
              className={
                styles.messageContextMenu
              }
              style={{
                left: menu.x,
                top: menu.y,
              }}
              role="menu"
            >
              <button
                type="button"
                className={
                  styles.messageContextMenuItem
                }
                onClick={
                  handleReply
                }
                role="menuitem"
              >
                <Reply
                  size={17}
                  aria-hidden="true"
                />

                <span>
                  رد على الرسالة
                </span>
              </button>

              <button
                type="button"
                className={
                  styles.messageContextMenuItem
                }
                onClick={
                  handleCopy
                }
                role="menuitem"
              >
                <Copy
                  size={17}
                  aria-hidden="true"
                />

                <span>
                  نسخ
                </span>
              </button>

              {isMine &&
                canEdit && (
                  <button
                    type="button"
                    className={
                      styles.messageContextMenuItem
                    }
                    onClick={
                      handleEdit
                    }
                    disabled={
                      isPending
                    }
                    role="menuitem"
                  >
                    <Pencil
                      size={17}
                      aria-hidden="true"
                    />

                    <span>
                      تعديل
                    </span>
                  </button>
                )}

              <form
                action={
                  togglePinnedGroupMessage
                }
                onSubmit={
                  closeMenu
                }
              >
                <input
                  type="hidden"
                  name="messageId"
                  value={
                    messageId
                  }
                />

                <button
                  type="submit"
                  className={
                    styles.messageContextMenuItem
                  }
                  role="menuitem"
                >
                  {isPinned ? (
                    <PinOff
                      size={17}
                      aria-hidden="true"
                    />
                  ) : (
                    <Pin
                      size={17}
                      aria-hidden="true"
                    />
                  )}

                  <span>
                    {isPinned
                      ? "إلغاء تثبيت الرسالة"
                      : "تثبيت الرسالة"}
                  </span>
                </button>
              </form>

              {isMine && (
                <button
                  type="button"
                  className={
                    styles.messageContextMenuItem
                  }
                  style={{
                    color:
                      "#ef4444",
                  }}
                  onClick={
                    handleDelete
                  }
                  disabled={
                    isPending
                  }
                  role="menuitem"
                >
                  <Trash2
                    size={17}
                    aria-hidden="true"
                  />

                  <span>
                    حذف للجميع
                  </span>
                </button>
              )}
            </div>
          </>,
          document.body,
        )}

      {actionModal && (
        <ChatMessageActionModal
          mode={
            actionModal
          }
          value={
            editBody
          }
          onChange={
            setEditBody
          }
          pending={
            isPending
          }
          onClose={() => {
            if (!isPending) {
              setActionModal(
                null,
              );
            }
          }}
          onConfirm={
            actionModal ===
            "edit"
              ? confirmEdit
              : confirmDelete
          }
        />
      )}
    </>
  );
}
