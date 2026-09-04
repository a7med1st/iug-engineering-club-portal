"use client";

import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
} from "react";

import styles from "./ChatMessagesHeaderLink.module.css";

type NotificationPayload = {
  ok: boolean;
  unreadCount: number;
};

export default function ChatMessagesHeaderLink() {
  const [unreadCount, setUnreadCount] =
    useState(0);

  const loadUnreadCount =
    useCallback(async () => {
      try {
        const response = await fetch(
          "/api/notifications?channel=chat&limit=1",
          {
            cache: "no-store",
          },
        );

        if (!response.ok) {
          return;
        }

        const data =
          (await response.json()) as NotificationPayload;

        setUnreadCount(
          data.unreadCount,
        );
      } catch {
        // Chat badge must never break the header.
      }
    }, []);

  useEffect(() => {
    void loadUnreadCount();

    const timer =
      window.setInterval(
        () => {
          if (
            document.visibilityState ===
            "visible"
          ) {
            void loadUnreadCount();
          }
        },
        5000,
      );

    const onVisibilityChange =
      () => {
        if (
          document.visibilityState ===
          "visible"
        ) {
          void loadUnreadCount();
        }
      };

    document.addEventListener(
      "visibilitychange",
      onVisibilityChange,
    );

    return () => {
      window.clearInterval(timer);

      document.removeEventListener(
        "visibilitychange",
        onVisibilityChange,
      );
    };
  }, [loadUnreadCount]);

  return (
    <Link
      className={`header-messages-link ${styles.root}`}
      href="/member/chat"
      aria-label={
        unreadCount > 0
          ? `رسائلي، ${unreadCount} رسالة غير مقروءة`
          : "رسائلي"
      }
      title="رسائلي"
    >
      <MessagesSquare
        aria-hidden="true"
      />

      {unreadCount > 0 && (
        <span
          className={styles.badge}
          aria-hidden="true"
        >
          {unreadCount > 99
            ? "99+"
            : unreadCount}
        </span>
      )}
    </Link>
  );
}