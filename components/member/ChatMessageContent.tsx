import { BarChart3, Check, Download, FileText } from "lucide-react";

import { voteOnChatPoll } from "@/app/member/chat/actions";
import styles from "@/app/member/chat/chat.module.css";
import ChatAudioPlayer from "@/components/member/ChatAudioPlayer";
import ChatImageLightbox from "@/components/member/ChatImageLightbox";

type Attachment = {
  id: string;
  originalName: string;
  mime: string;
  size: number;
};

type PollVote = {
  userId: string;
  optionIndex: number;
};

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} بايت`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} كيلوبايت`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} ميجابايت`;
}

const messageUrlPattern =
  /((?:https?:\/\/|www\.)[^\s<]+)/gi;

function renderMessageText(text: string) {
  const parts = text.split(messageUrlPattern);

  return parts.map((part, index) => {
    const isUrl =
      /^(?:https?:\/\/|www\.)/i.test(part);

    if (!isUrl) {
      return part;
    }

    /*
     * نفصل علامات الترقيم الموجودة بعد الرابط
     * حتى لا تدخل ضمن الرابط نفسه.
     */
    const trailingMatch =
      part.match(/[.,!?،؛:]+$/);

    const trailing =
      trailingMatch?.[0] ?? "";

    const cleanUrl = trailing
      ? part.slice(
        0,
        -trailing.length,
      )
      : part;

    const href =
      cleanUrl.startsWith("www.")
        ? `https://${cleanUrl}`
        : cleanUrl;

    return (
      <span key={`${cleanUrl}-${index}`}>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.messageLink}
        >
          {cleanUrl}
        </a>

        {trailing}
      </span>
    );
  });
}

export default function ChatMessageContent({
  messageId,
  kind,
  body,
  attachments,
  pollQuestion,
  pollOptions,
  pollVotes,
  currentUserId,
}: {
  messageId: string;
  kind: string;
  body: string;
  attachments: Attachment[];
  pollQuestion: string | null;
  pollOptions: string[];
  pollVotes: PollVote[];
  currentUserId: string;
}) {
  const currentVote = pollVotes.find((vote) => vote.userId === currentUserId)?.optionIndex;
  const totalVotes = pollVotes.length;
  const generatedAttachmentLabel =
    kind === "ATTACHMENT" &&
    (body === "صورة" ||
      body === "فيديو" ||
      body === "ملف صوتي" ||
      body === "رسالة صوتية" ||
      attachments.some((attachment) => body === `ملف: ${attachment.originalName}`));

  return (
    <div className={styles.messageContent}>
      {kind !== "POLL" &&
        body &&
        !generatedAttachmentLabel && (
          <p className={styles.messageCaption}>
            {renderMessageText(body)}
          </p>
        )}

      {attachments.map((attachment) => {
        const source = `/member/chat/attachments/${attachment.id}`;
        const isImage = /^image\/(jpeg|png|gif|webp)$/i.test(attachment.mime);
        const isAudio = /^audio\/(mpeg|mp4|ogg|wav|webm)/i.test(attachment.mime);
        const isVideo = /^video\/(mp4|webm|ogg)/i.test(attachment.mime);

        if (isImage) {
          return (
            <ChatImageLightbox
              key={attachment.id}
              src={source}
              alt={
                attachment.originalName
              }
            />
          );
        }

        if (isAudio) {
          return (
            <ChatAudioPlayer key={attachment.id} src={source} />
          );
        }

        if (isVideo) {
          return (
            <div key={attachment.id} className={styles.messageMedia}>
              <video src={source} controls preload="metadata" playsInline />
              <span>{attachment.originalName}</span>
            </div>
          );
        }

        return (
          <a key={attachment.id} href={source} className={styles.messageFile} download>
            <span className={styles.messageFileIcon}><FileText aria-hidden="true" /></span>
            <span className={styles.messageFileInfo}>
              <strong>{attachment.originalName}</strong>
              <small>{fileSize(attachment.size)}</small>
            </span>
            <Download aria-hidden="true" />
          </a>
        );
      })}

      {kind === "POLL" && pollQuestion && (
        <section className={styles.messagePoll} aria-label={`تصويت: ${pollQuestion}`}>
          <div className={styles.messagePollTitle}>
            <BarChart3 aria-hidden="true" />
            <strong>{pollQuestion}</strong>
          </div>
          <div className={styles.messagePollOptions}>
            {pollOptions.map((option, index) => {
              const votes = pollVotes.filter((vote) => vote.optionIndex === index).length;
              const percent = totalVotes ? Math.round((votes / totalVotes) * 100) : 0;
              const selected = currentVote === index;

              return (
                <form key={`${messageId}-${index}`} action={voteOnChatPoll}>
                  <input type="hidden" name="messageId" value={messageId} />
                  <input type="hidden" name="optionIndex" value={index} />
                  <button type="submit" className={`${styles.pollVoteButton} ${selected ? styles.pollVoteButtonSelected : ""}`} aria-pressed={selected}>
                    <span className={styles.pollVoteProgress} style={{ width: `${percent}%` }} />
                    <span className={styles.pollVoteLabel}>{selected && <Check aria-hidden="true" />}{option}</span>
                    <span className={styles.pollVotePercent}>{percent}%</span>
                  </button>
                </form>
              );
            })}
          </div>
          <small className={styles.pollVoteCount}>{totalVotes ? `${totalVotes} صوت` : "لا توجد أصوات بعد"}</small>
        </section>
      )}
    </div>
  );
}
