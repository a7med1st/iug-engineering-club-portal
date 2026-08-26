import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Check, CheckCheck, UsersRound } from "lucide-react";
import ChatComposer from "@/components/member/ChatComposer";
import ChatConversationView from "@/components/member/ChatConversationView";
import ChatGroupTypingStatus from "@/components/member/ChatGroupTypingStatus";
import ChatMessageContent from "@/components/member/ChatMessageContent";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { getSystemGroupMembership } from "@/lib/chat-groups";
import chatStyles from "../../chat.module.css";
import styles from "../groups.module.css";

export const dynamic = "force-dynamic";
const fmtTime = (d: Date) => new Intl.DateTimeFormat("ar-PS", { hour: "2-digit", minute: "2-digit" }).format(d);
const fmtDay = (d: Date) => new Intl.DateTimeFormat("ar-PS", { dateStyle: "medium" }).format(d);

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requirePermission(PERMISSIONS.MEMBER_DASHBOARD);
  const { id } = await params;
  const membership = await getSystemGroupMembership(user.id, id);
  if (!membership) redirect("/member/chat/groups");
  const conversation = membership.conversation;
  let lastDay = "";
  const rows = conversation.messages.map((m) => {
    const day = fmtDay(m.createdAt);
    const showDay = day !== lastDay;
    lastDay = day;
    const mine = m.senderId === user.id;
    const receipts = mine ? m.receipts.filter((r) => r.userId !== user.id) : [];
    const state = !mine ? null : receipts.length && receipts.every((r) => r.readAt)
      ? "READ"
      : receipts.length && receipts.every((r) => r.deliveredAt)
        ? "DELIVERED"
        : "SENT";
    return {
      id: m.id,
      body: m.body,
      kind: m.kind,
      attachments: m.attachments,
      pollQuestion: m.pollQuestion,
      pollOptions: m.pollOptions,
      pollVotes: m.pollVotes,
      imageOnly:
        m.body === "صورة" &&
        m.attachments.some((attachment) =>
          /^image\/(jpeg|png|gif|webp)$/i.test(attachment.mime),
        ),
      mine,
      senderName: m.sender.name,
      time: fmtTime(m.createdAt),
      day: showDay ? day : null,
      state,
    };
  });
  const lastMessageId = conversation.messages.at(-1)?.id ?? "";
  return (
    <main className={styles.conversationPage}>
      <section className={chatStyles.conversation}>
        <header className={chatStyles.conversationHeader}>
          <div className={chatStyles.partnerAvatar}><UsersRound /></div>
          <div className={chatStyles.partnerInfo}>
            <h1>{conversation.name ?? "مجموعة"}</h1>
            <p><ChatGroupTypingStatus conversationId={id} participantCount={conversation.participants.length} /></p>
          </div>
          <Link
            href="/member/chat"
            className={chatStyles.mobileChatBack}
            aria-label="العودة إلى قائمة المحادثات"
            title="العودة إلى المحادثات"
          >
            <ArrowRight aria-hidden="true" />
          </Link>
        </header>
        <ChatConversationView conversationId={id} lastMessageId={lastMessageId}>
          <div className={chatStyles.messages}>
            {rows.map((m) => (
              <div key={m.id}>
                {m.day && <div className={chatStyles.dayDivider}><span>{m.day}</span></div>}
                <article
                  className={`${m.mine ? chatStyles.messageMine : chatStyles.messageOther} ${m.attachments.length ? chatStyles.messageWithAttachment : ""} ${m.imageOnly ? chatStyles.messageImageOnly : ""}`}
                >
                  {!m.mine && <small className={chatStyles.senderName}>{m.senderName}</small>}
                  <ChatMessageContent
                    messageId={m.id}
                    kind={m.kind}
                    body={m.body}
                    attachments={m.attachments}
                    pollQuestion={m.pollQuestion}
                    pollOptions={m.pollOptions}
                    pollVotes={m.pollVotes}
                    currentUserId={user.id}
                  />
                  <div className={chatStyles.messageFooter}>
                    <time>{m.time}</time>
                    {m.mine && m.state === "SENT" && <Check size={15} className={chatStyles.deliverySent} />}
                    {m.mine && m.state === "DELIVERED" && <CheckCheck size={16} className={chatStyles.deliveryDelivered} />}
                    {m.mine && m.state === "READ" && <CheckCheck size={16} className={chatStyles.deliveryRead} />}
                  </div>
                </article>
              </div>
            ))}
            <div id="chat-bottom" aria-hidden="true" />
          </div>
        </ChatConversationView>
        <ChatComposer conversationId={id} className={chatStyles.composer} />
      </section>
    </main>
  );
}
