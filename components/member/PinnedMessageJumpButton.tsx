"use client";

export default function PinnedMessageJumpButton({
  messageId,
  className,
}: {
  messageId: string;
  className?: string;
}) {
  const jumpToMessage = () => {
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
      top: Math.max(targetTop, 0),
      behavior: "smooth",
    });
  };

  return (
    <button
      type="button"
      className={className}
      onClick={jumpToMessage}
    >
      عرض الرسالة
    </button>
  );
}