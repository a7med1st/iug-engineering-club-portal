"use client";

import { Send } from "lucide-react";
import {
  useEffect,
  useRef,
} from "react";

import { sendChatMessage } from "@/app/member/chat/actions";

export default function ChatComposer({
  conversationId,
  className,
}: {
  conversationId: string;
  className: string;
}) {
  const textareaRef =
    useRef<HTMLTextAreaElement | null>(null);

  const typingTimer =
    useRef<number | null>(null);

  const lastTypingPing = useRef(0);

  const sendTyping = async (active: boolean) => {
    try {
      await fetch(
        `/member/chat/${conversationId}/typing`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ active }),
          cache: "no-store",
        },
      );
    } catch {}
  };

  const stopTyping = () => {
    if (typingTimer.current !== null) {
      window.clearTimeout(typingTimer.current);
      typingTimer.current = null;
    }

    void sendTyping(false);
  };

  const onInput = (
    event: React.FormEvent<HTMLTextAreaElement>,
  ) => {
    const textarea = event.currentTarget;

    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;

    const now = Date.now();

    if (
      textarea.value.trim() &&
      now - lastTypingPing.current > 900
    ) {
      lastTypingPing.current = now;
      void sendTyping(true);
    }

    if (typingTimer.current !== null) {
      window.clearTimeout(typingTimer.current);
    }

    typingTimer.current = window.setTimeout(() => {
      void sendTyping(false);
    }, 2_200);
  };

  useEffect(() => {
    return () => {
      if (typingTimer.current !== null) {
        window.clearTimeout(typingTimer.current);
      }

      void sendTyping(false);
    };
  }, []);

  return (
    <form
      action={sendChatMessage}
      className={className}
      onSubmit={() => {
        stopTyping();

        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
        }
      }}
    >
      <input
        type="hidden"
        name="conversationId"
        value={conversationId}
      />

      <textarea
        ref={textareaRef}
        name="body"
        rows={1}
        maxLength={3000}
        placeholder="اكتب رسالتك..."
        required
        onInput={onInput}
        onBlur={stopTyping}
      />

      <button
        type="submit"
        aria-label="إرسال الرسالة"
        title="إرسال"
      >
        <Send aria-hidden="true" />
      </button>
    </form>
  );
}
