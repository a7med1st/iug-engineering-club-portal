"use client";

export default function ReplyMessageJump({
  messageId,
  className,
  children,
}: {
  messageId: string;
  className?: string;
  children: React.ReactNode;
}) {
  const handleClick = () => {
    const target =
      document.getElementById(
        `message-${messageId}`,
      );

    if (!target) {
      return;
    }

    const messages =
      target.closest(
        '[data-chat-messages="true"]',
      ) as HTMLElement | null;

    if (!messages) {
      return;
    }

    const targetTop =
      target.offsetTop -
      messages.offsetTop -
      20;

    messages.scrollTo({
      top: Math.max(
        targetTop,
        0,
      ),
      behavior: "smooth",
    });

    target.classList.add(
      "reply-jump-highlight",
    );

    window.setTimeout(() => {
      target.classList.remove(
        "reply-jump-highlight",
      );
    }, 1200);
  };

  return (
    <button
      type="button"
      className={className}
      onClick={handleClick}
      aria-label="الذهاب إلى الرسالة الأصلية"
    >
      {children}
    </button>
  );
}