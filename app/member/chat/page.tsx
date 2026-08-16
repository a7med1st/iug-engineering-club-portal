import {
  MessageCircleMore,
  Users,
} from "lucide-react";

import styles from "./chat.module.css";

export default async function ChatHomePage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
  }>;
}) {
  const feedback = await searchParams;

  return (
    <section className={styles.emptyConversation}>
      {feedback.error && (
        <div className={styles.feedbackError}>{feedback.error}</div>
      )}

      <div className={styles.emptyIcon}>
        <MessageCircleMore size={36} />
      </div>

      <h1>محادثات أعضاء النادي</h1>
      <p>
        اختر محادثة من القائمة أو ابدأ محادثة جديدة مع أحد أعضاء النادي.
      </p>

      <div className={styles.emptyHint}>
        <Users size={17} />
        الشات متاح للأعضاء والإدارة فقط
      </div>
    </section>
  );
}
