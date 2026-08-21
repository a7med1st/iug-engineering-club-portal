import {
  MessageCircleMore,
  ShieldCheck,
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

      <div className={styles.emptyVisual} aria-hidden="true">
        <span className={styles.emptyOrbit} />
        <span className={styles.emptyOrbitSecondary} />

        <div className={styles.emptyIcon}>
          <MessageCircleMore size={38} />
        </div>
      </div>

      <h1>محادثات أعضاء النادي</h1>

      <p>
        اختر محادثة من القائمة، أو ابدأ محادثة جديدة مع أحد أعضاء
        النادي والإدارة.
      </p>

      <div className={styles.emptyHints}>
        <span className={styles.emptyHint}>
          <Users size={17} />
          تواصل مباشر بين الأعضاء
        </span>

        <span className={styles.emptyHint}>
          <ShieldCheck size={17} />
          متاح للأعضاء والإدارة فقط
        </span>
      </div>
    </section>
  );
}
