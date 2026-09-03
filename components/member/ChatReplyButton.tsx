"use client";

import { Reply } from "lucide-react";

export default function ChatReplyButton({
  messageId,
  senderName,
  body,
  className,
}: {
  messageId: string;
  senderName: string;
  body: string;
  className?: string;
}) {
  const handleReply = () => {
    window.dispatchEvent(
      new CustomEvent("chat-reply-selected", {
        detail: {
          messageId,
          senderName,
          body,
        },
      }),
    );
  };

  return (
    <button
      type="button"
      className={className}
      onClick={handleReply}
      aria-label={`رد على رسالة ${senderName}`}
      title="رد"
    >
      <Reply size={14} aria-hidden="true" />
    </button>
  );
}