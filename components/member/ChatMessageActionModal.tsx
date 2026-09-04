"use client";

import {
  Pencil,
  Trash2,
  X,
} from "lucide-react";

import {
  useEffect,
} from "react";

import {
  createPortal,
} from "react-dom";

import styles from "@/app/member/chat/chat.module.css";

type Props = {
  mode: "edit" | "delete";
  value?: string;
  onChange?: (
    value: string,
  ) => void;
  onClose: () => void;
  onConfirm: () => void;
  pending?: boolean;
};

export default function ChatMessageActionModal({
  mode,
  value = "",
  onChange,
  onClose,
  onConfirm,
  pending = false,
}: Props) {
  useEffect(() => {
    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (
        event.key ===
        "Escape"
      ) {
        onClose();
      }
    };

    document.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [onClose]);

  return createPortal(
    <div
      className={
        styles.chatActionModalOverlay
      }
      onMouseDown={
        onClose
      }
    >
      <section
        className={
          styles.chatActionModalCard
        }
        onMouseDown={(
          event,
        ) =>
          event.stopPropagation()
        }
        role="dialog"
        aria-modal="true"
      >
        <div
          className={
            styles.chatActionModalHead
          }
        >
          <div
            className={
              mode === "delete"
                ? styles.chatActionModalIconDanger
                : styles.chatActionModalIcon
            }
          >
            {mode === "delete" ? (
              <Trash2
                size={20}
              />
            ) : (
              <Pencil
                size={20}
              />
            )}
          </div>

          <div
            className={
              styles.chatActionModalTitle
            }
          >
            <strong>
              {mode ===
              "delete"
                ? "حذف الرسالة"
                : "تعديل الرسالة"}
            </strong>

            <span>
              {mode ===
              "delete"
                ? "سيتم حذف الرسالة لدى جميع المشاركين."
                : "عدّل محتوى الرسالة ثم احفظ التغييرات."}
            </span>
          </div>

          <button
            type="button"
            className={
              styles.chatActionModalClose
            }
            onClick={
              onClose
            }
            aria-label="إغلاق"
          >
            <X size={18} />
          </button>
        </div>

        {mode === "edit" ? (
          <div
            className={
              styles.chatActionModalBody
            }
          >
            <textarea
              value={value}
              onChange={(
                event,
              ) =>
                onChange?.(
                  event.target
                    .value,
                )
              }
              rows={5}
              maxLength={
                3000
              }
              autoFocus
              className={
                styles.chatActionModalTextarea
              }
            />

            <div
              className={
                styles.chatActionModalCounter
              }
            >
              {
                value.length
              }
              /3000
            </div>
          </div>
        ) : (
          <div
            className={
              styles.chatActionDeleteWarning
            }
          >
            <Trash2
              size={18}
            />

            <p>
              لا يمكن التراجع
              عن هذا الإجراء بعد
              حذف الرسالة.
            </p>
          </div>
        )}

        <div
          className={
            styles.chatActionModalActions
          }
        >
          <button
            type="button"
            className={
              styles.chatActionModalCancel
            }
            onClick={
              onClose
            }
            disabled={
              pending
            }
          >
            إلغاء
          </button>

          <button
            type="button"
            className={
              mode === "delete"
                ? styles.chatActionModalDelete
                : styles.chatActionModalSave
            }
            onClick={
              onConfirm
            }
            disabled={
              pending ||
              (mode ===
                "edit" &&
                !value.trim())
            }
          >
            {mode ===
            "delete" ? (
              <>
                <Trash2
                  size={17}
                />
                {pending
                  ? "جارٍ الحذف..."
                  : "حذف للجميع"}
              </>
            ) : (
              <>
                <Pencil
                  size={17}
                />
                {pending
                  ? "جارٍ الحفظ..."
                  : "حفظ التعديلات"}
              </>
            )}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}