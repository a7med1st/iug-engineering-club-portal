"use client";

import {
  useEffect,
  useRef,
} from "react";
import { useRouter } from "next/navigation";

export default function ChatConversationView({
  conversationId,
  lastMessageId,
  children,
}: {
  conversationId: string;
  lastMessageId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const firstRender = useRef(true);

  useEffect(() => {
    const markRead = async () => {
      try {
        await fetch(
          `/member/chat/${conversationId}/read`,
          {
            method: "POST",
            cache: "no-store",
          },
        );
      } catch { }
    };

    void markRead();
  }, [conversationId, lastMessageId]);

  useEffect(() => {
    const bottom =
      document.getElementById(
        "chat-bottom",
      );

    const messagesContainer =
      bottom?.closest(
        '[data-chat-messages="true"]',
      ) as HTMLElement | null;

    if (!messagesContainer) {
      return;
    }

    messagesContainer.scrollTo({
      top: messagesContainer.scrollHeight,

      behavior:
        firstRender.current
          ? "auto"
          : "smooth",
    });

    firstRender.current = false;
  }, [lastMessageId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    }, 2_500);

    return () => window.clearInterval(timer);
  }, [router]);

  return <>{children}</>;
}
