"use client";

import { useEffect } from "react";

export default function MemberPresenceHeartbeat() {
  useEffect(() => {
    let stopped = false;

    const heartbeat = async () => {
      if (
        stopped ||
        document.visibilityState !== "visible"
      ) {
        return;
      }

      try {
        await fetch("/api/member/presence", {
          method: "POST",
          cache: "no-store",
          keepalive: true,
        });
      } catch {}
    };

    void heartbeat();

    const timer = window.setInterval(() => {
      void heartbeat();
    }, 12_000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void heartbeat();
      }
    };

    document.addEventListener(
      "visibilitychange",
      onVisibility,
    );

    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener(
        "visibilitychange",
        onVisibility,
      );
    };
  }, []);

  return null;
}
