"use client";

import Link from "next/link";
import { BellRing } from "lucide-react";
import { useState } from "react";

import styles from "./ClubUpdatesTicker.module.css";

export type ClubUpdate = {
  id: string;
  title: string;
  href?: string | null;
  createdAt?: string;
};

export default function ClubUpdatesTicker({
  updates,
}: {
  updates: ClubUpdate[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (updates.length === 0) {
    return null;
  }

  const activeUpdate = updates[activeIndex % updates.length];

  const showNext = () => {
    setActiveIndex((current) => current + 1);
  };

  return (
    <section
      id="club-updates"
      className={`shell ${styles.section}`}
      aria-label="آخر تحديثات النادي"
      data-reveal="up"
    >
      <div className={styles.ticker}>
        <div className={styles.label}>
          <span className={styles.labelIcon} aria-hidden="true">
            <BellRing size={17} strokeWidth={2.15} />
          </span>
          <strong>آخر تحديثات النادي</strong>
        </div>

        <div className={styles.viewport}>
          <div className={styles.updates} aria-live="off">
            <div
              className={styles.update}
              key={`${activeIndex}-${activeUpdate.id}`}
              onAnimationEnd={showNext}
            >
              <span className={styles.dot} aria-hidden="true" />
              {activeUpdate.href ? (
                <Link
                  className={styles.updateLink}
                  href={activeUpdate.href}
                  title={activeUpdate.title}
                >
                  {activeUpdate.title}
                </Link>
              ) : (
                <span
                  className={styles.updateText}
                  title={activeUpdate.title}
                >
                  {activeUpdate.title}
                </span>
              )}
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
