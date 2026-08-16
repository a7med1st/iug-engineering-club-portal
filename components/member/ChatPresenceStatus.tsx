"use client";

import { useEffect, useState } from "react";

type StatusPayload = {
  ok: boolean;
  online: boolean;
  typing: boolean;
  lastSeenAt: string | null;
};

function formatLastSeen(value: string | null) {
  if (!value) return "غير متصل";

  const date = new Date(value);
  const now = new Date();

  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (sameDay) {
    return `آخر ظهور اليوم ${new Intl.DateTimeFormat(
      "ar-PS",
      {
        hour: "2-digit",
        minute: "2-digit",
      },
    ).format(date)}`;
  }

  return `آخر ظهور ${new Intl.DateTimeFormat("ar-PS", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)}`;
}

export default function ChatPresenceStatus({
  conversationId,
  initialLastSeenAt,
}: {
  conversationId: string;
  initialLastSeenAt: string | null;
}) {
  const [status, setStatus] = useState<StatusPayload>({
    ok: true,
    online: false,
    typing: false,
    lastSeenAt: initialLastSeenAt,
  });

  useEffect(() => {
    let stopped = false;

    const load = async () => {
      try {
        const response = await fetch(
          `/member/chat/${conversationId}/status`,
          { cache: "no-store" },
        );

        if (!response.ok) return;

        const next =
          (await response.json()) as StatusPayload;

        if (!stopped) setStatus(next);
      } catch {}
    };

    void load();

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void load();
      }
    }, 1_500);

    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [conversationId]);

  if (status.typing) {
    return (
      <span data-chat-presence="typing">
        يكتب الآن...
      </span>
    );
  }

  if (status.online) {
    return (
      <span data-chat-presence="online">
        متصل الآن
      </span>
    );
  }

  return (
    <span data-chat-presence="offline">
      {formatLastSeen(status.lastSeenAt)}
    </span>
  );
}
