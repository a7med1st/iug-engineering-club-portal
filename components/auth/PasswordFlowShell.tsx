import type { ReactNode } from "react";

import styles from "./password-flow.module.css";

export default function PasswordFlowShell({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className={styles.page} dir="rtl">
      <div className={styles.glow} aria-hidden="true" />
      <section className={styles.card}>
        <div className={styles.accent} aria-hidden="true" />
        <div className={styles.iconWrap} aria-hidden="true">{icon}</div>
        <h1>{title}</h1>
        <p className={styles.lead}>{description}</p>
        {children}
      </section>
    </main>
  );
}
