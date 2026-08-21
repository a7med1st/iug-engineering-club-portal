"use client";

import Link from "next/link";
import {
  UsersRound,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";

import styles from "@/app/member/chat/chat.module.css";

type GroupRow = {
  id: string;
  name: string;
  participantCount: number;
  unreadCount: number;

  lastMessage: {
    body: string;
    senderName: string;
    createdAt: string;
  } | null;
};

type Payload = {
  ok: boolean;
  groups: GroupRow[];
};

function preview(
  group: GroupRow,
) {
  if (!group.lastMessage) {
    return `${group.participantCount} عضو`;
  }

  const text =
    `${group.lastMessage.senderName}: ${group.lastMessage.body}`;

  return text.length > 58
    ? `${text.slice(0, 55)}...`
    : text;
}

export default function ChatGroupsInlineSection() {
  const [groups, setGroups] =
    useState<GroupRow[]>([]);

  useEffect(() => {
    let stopped = false;

    const load = async () => {
      try {
        const response =
          await fetch(
            "/api/member/chat/groups",
            {
              cache: "no-store",
            },
          );

        if (!response.ok) {
          return;
        }

        const data =
          (await response.json()) as Payload;

        if (!stopped) {
          setGroups(data.groups ?? []);
        }
      } catch {
        // Keep the sidebar usable if refreshing groups fails.
      }
    };

    void load();

    const timer =
      window.setInterval(
        () => {
          if (
            document.visibilityState ===
            "visible"
          ) {
            void load();
          }
        },
        4000,
      );

    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, []);

  if (!groups.length) {
    return null;
  }

  return (
    <section
      className={styles.sidebarGroups}
      aria-label="مجموعات النادي"
    >
      <div className={styles.sidebarSectionTitle}>
        <span className={styles.sidebarSectionTitleMain}>
          <span>المجموعات</span>

          <span className={styles.sidebarSectionCount}>
            {groups.length > 99 ? "99+" : groups.length}
          </span>
        </span>

        <Link href="/member/chat/groups">
          عرض الكل
        </Link>
      </div>

      <div className={styles.sidebarGroupList}>
        {groups.map(
          (group) => (
            <Link
              key={group.id}
              href={`/member/chat/groups/${group.id}`}
              className={styles.sidebarGroupItem}
            >
              <span className={styles.sidebarGroupIcon}>
                <UsersRound aria-hidden="true" />
              </span>

              <span className={styles.sidebarGroupText}>
                <strong>{group.name}</strong>

                <small>
                  {preview(group)}
                </small>
              </span>

              {group.unreadCount > 0 && (
                <span className={styles.sidebarGroupBadge}>
                  {group.unreadCount > 99
                    ? "99+"
                    : group.unreadCount}
                </span>
              )}
            </Link>
          ),
        )}
      </div>
    </section>
  );
}