"use client";

import { useEffect, useState } from "react";

type Payload = { ok: boolean; typingNames: string[]; onlineCount: number };

function typingLabel(names: string[]) {
  if (names.length === 1) return `${names[0]} يكتب الآن...`;
  if (names.length === 2) return `${names[0]} و${names[1]} يكتبان الآن...`;
  return `${names[0]} و${names.length - 1} آخرون يكتبون الآن...`;
}

export default function ChatGroupTypingStatus({
  conversationId,
  participantCount,
}: {
  conversationId: string;
  participantCount: number;
}) {
  const [state, setState] = useState<Payload>({ ok: true, typingNames: [], onlineCount: 0 });

  useEffect(() => {
    let stopped = false;
    const load = async () => {
      try {
        const res = await fetch(`/member/chat/${conversationId}/group-status`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as Payload;
        if (!stopped) setState(data);
      } catch {}
    };
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 1500);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [conversationId]);

  if (state.typingNames.length) return <span>{typingLabel(state.typingNames)}</span>;
  return <span>{participantCount} عضو · {state.onlineCount} متصل</span>;
}
