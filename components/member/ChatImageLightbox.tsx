"use client";

import {
  X,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";
import {
  createPortal,
} from "react-dom";

import styles from "@/app/member/chat/chat.module.css";

export default function ChatImageLightbox({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  const [open, setOpen] =
    useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (
        event.key === "Escape"
      ) {
        setOpen(false);
      }
    };

    document.addEventListener(
      "keydown",
      onKeyDown,
    );

    return () => {
      document.removeEventListener(
        "keydown",
        onKeyDown,
      );
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={
          styles.messageImageButton
        }
        onClick={() =>
          setOpen(true)
        }
        aria-label="عرض الصورة"
      >
        <img
          src={src}
          alt={alt}
          className={
            styles.messageImage
          }
        />
      </button>

      {open &&
        createPortal(
          <div
            className={
              styles.chatImageLightbox
            }
            role="dialog"
            aria-modal="true"
            aria-label="معاينة الصورة"
            onPointerDown={(
              event,
            ) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                setOpen(false);
              }
            }}
          >
            <button
              type="button"
              className={
                styles.chatImageLightboxClose
              }
              onClick={() =>
                setOpen(false)
              }
              aria-label="إغلاق الصورة"
              title="إغلاق"
            >
              <X
                size={24}
                aria-hidden="true"
              />
            </button>

            <img
              src={src}
              alt={alt}
              className={
                styles.chatImageLightboxImage
              }
            />
          </div>,
          document.body,
        )}
    </>
  );
}