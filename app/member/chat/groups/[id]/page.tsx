import { redirect } from "next/navigation";
import { Check, CheckCheck, UsersRound } from "lucide-react";
import ChatComposer from "@/components/member/ChatComposer";
import ChatConversationView from "@/components/member/ChatConversationView";
import ChatGroupTypingStatus from "@/components/member/ChatGroupTypingStatus";
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
    return { id: m.id, body: m.body, mine, senderName: m.sender.name, time: fmtTime(m.createdAt), day: showDay ? day : null, state };
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
        </header>
        <ChatConversationView conversationId={id} lastMessageId={lastMessageId}>
          <div className={chatStyles.messages}>
            {rows.map((m) => (
              <div key={m.id}>
                {m.day && <div className={chatStyles.dayDivider}><span>{m.day}</span></div>}
                <article className={m.mine ? chatStyles.messageMine : chatStyles.messageOther}>
                  {!m.mine && <small className={chatStyles.senderName}>{m.senderName}</small>}
                  <p>{m.body}</p>
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
