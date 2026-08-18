import Link from "next/link";
import { MessagesSquare, UsersRound } from "lucide-react";
import { PERMISSIONS, requirePermission } from "@/lib/permissions";
import { getSystemGroupsForUser } from "@/lib/chat-groups";
import styles from "./groups.module.css";

export const dynamic = "force-dynamic";

export default async function ChatGroupsPage() {
  const { user } = await requirePermission(PERMISSIONS.MEMBER_DASHBOARD);
  const groups = await getSystemGroupsForUser(user.id);
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div><span>INTERNAL GROUPS</span><h1>مجموعات النادي</h1><p>المجموعة العامة ومجموعة القسم تظهران تلقائيًا حسب الحساب.</p></div>
        <Link href="/member/chat" className={styles.directLink}><MessagesSquare size={18} /> المحادثات الخاصة</Link>
      </header>
      <section className={styles.grid}>
        {groups.map((g) => (
          <Link key={g.id} href={`/member/chat/groups/${g.id}`} className={styles.card}>
            <div className={styles.avatar}><UsersRound /></div>
            <div className={styles.content}>
              <div className={styles.nameRow}><strong>{g.name}</strong>{g.unreadCount > 0 && <span className={styles.badge}>{g.unreadCount}</span>}</div>
              <span className={styles.members}>{g.participantCount} عضو</span>
              <p>{g.lastMessage ? `${g.lastMessage.sender.name}: ${g.lastMessage.body}` : "لا توجد رسائل بعد."}</p>
            </div>
          </Link>
        ))}
      </section>
    </main>
  );
}
