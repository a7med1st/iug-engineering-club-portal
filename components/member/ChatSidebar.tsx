"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Check,
  ChevronDown,
  MessageCirclePlus,
  Search,
  UserRoundPlus,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  startDirectConversation,
} from "@/app/member/chat/actions";

import ChatGroupsInlineSection from "@/components/member/ChatGroupsInlineSection";

import styles from "@/app/member/chat/chat.module.css";

type ConversationRow = {
  id: string;

  partner: {
    id: string;
    name: string;
    role:
      | "STUDENT"
      | "MEMBER"
      | "ADMIN";
    title: string;
    department:
      | string
      | null;
    hasAvatar: boolean;
    avatarVersion: number;
  } | null;

  lastMessage: {
    body: string;
    createdAt: string;
    mine: boolean;
  } | null;

  unreadCount: number;
  sortTime: number;
};

type AvailableUser = {
  id: string;
  name: string;

  role:
    | "STUDENT"
    | "MEMBER"
    | "ADMIN";

  title: string;

  department:
    | string
    | null;
};

function formatSidebarTime(
  value: string,
) {
  const date = new Date(value);
  const today = new Date();

  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  if (sameDay) {
    return new Intl.DateTimeFormat(
      "ar-PS",
      {
        hour: "2-digit",
        minute: "2-digit",
      },
    ).format(date);
  }

  return new Intl.DateTimeFormat(
    "ar-PS",
    {
      month: "short",
      day: "numeric",
    },
  ).format(date);
}

export default function ChatSidebar({
  conversations,
  availableUsers,
}: {
  conversations: ConversationRow[];
  availableUsers: AvailableUser[];
}) {
  const pathname = usePathname();

  const [query, setQuery] = useState("");
  const [showNew, setShowNew] = useState(false);

  const [targetUserId, setTargetUserId] = useState("");
  const [memberMenuOpen, setMemberMenuOpen] = useState(false);

  const memberSelectRef = useRef<HTMLDivElement>(null);

  const selectedMember = availableUsers.find(
    (member) => member.id === targetUserId,
  );

  useEffect(() => {
    const closeMenu = (event: PointerEvent) => {
      const target = event.target as Node;

      if (
        !memberSelectRef.current?.contains(target)
      ) {
        setMemberMenuOpen(false);
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMemberMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeMenu);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeMenu);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const filtered = useMemo(() => {
    const normalized = query
      .trim()
      .toLocaleLowerCase();

    if (!normalized) {
      return conversations;
    }

    return conversations.filter(
      (item) => {
        const partner = item.partner;

        if (!partner) {
          return false;
        }

        return [
          partner.name,
          partner.title,
          partner.department ?? "",
        ]
          .join(" ")
          .toLocaleLowerCase()
          .includes(normalized);
      },
    );
  }, [
    conversations,
    query,
  ]);

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarTop}>
        <div>
          <h2>المحادثات</h2>
          <p className={styles.sidebarSubtitle}>
            تواصل مع أعضاء النادي والإدارة.
          </p>
        </div>

        <button
          type="button"
          className={styles.newChatButton}
          onClick={() =>
            setShowNew(
              (value) => !value,
            )
          }
          aria-expanded={showNew}
          title="بدء محادثة جديدة"
        >
          <MessageCirclePlus size={20} />
        </button>
      </div>

      {showNew && (
        <form
          action={startDirectConversation}
          className={styles.newConversation}
        >
          <div className={styles.newConversationHead}>
            <span className={styles.newConversationIcon}>
              <UserRoundPlus size={18} />
            </span>

            <div>
              <strong>محادثة جديدة</strong>
              <small>اختر العضو الذي تريد التواصل معه.</small>
            </div>
          </div>

          <input
            type="hidden"
            name="targetUserId"
            value={targetUserId}
          />

          <div
            ref={memberSelectRef}
            className={styles.memberSelectWrap}
          >
            <button
              type="button"
              className={`${styles.memberSelectTrigger} ${
                memberMenuOpen
                  ? styles.memberSelectTriggerOpen
                  : ""
              }`}
              onClick={() =>
                setMemberMenuOpen(
                  (value) => !value,
                )
              }
              aria-expanded={memberMenuOpen}
              aria-haspopup="listbox"
            >
              <span className={styles.memberSelectCopy}>
                <strong>
                  {selectedMember
                    ? selectedMember.name
                    : "اختر عضوًا"}
                </strong>

                <small>
                  {selectedMember
                    ? `${selectedMember.title}${
                        selectedMember.department
                          ? ` · ${selectedMember.department}`
                          : ""
                      }`
                    : "اضغط لعرض أعضاء النادي"}
                </small>
              </span>

              <span
                className={`${styles.memberSelectChevron} ${
                  memberMenuOpen
                    ? styles.memberSelectChevronOpen
                    : ""
                }`}
              >
                <ChevronDown size={18} />
              </span>
            </button>

            {memberMenuOpen && (
              <div
                className={styles.memberSelectMenu}
                role="listbox"
              >
                {availableUsers.length ? (
                  availableUsers.map((member) => {
                    const active =
                      member.id === targetUserId;

                    return (
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        key={member.id}
                        className={`${styles.memberSelectOption} ${
                          active
                            ? styles.memberSelectOptionActive
                            : ""
                        }`}
                        onClick={() => {
                          setTargetUserId(member.id);
                          setMemberMenuOpen(false);
                        }}
                      >
                        <span className={styles.memberSelectMark}>
                          {active && <Check size={14} />}
                        </span>

                        <span className={styles.memberSelectOptionCopy}>
                          <strong>{member.name}</strong>

                          <small>
                            {member.title}
                            {member.department
                              ? ` · ${member.department}`
                              : ""}
                          </small>
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <div className={styles.memberSelectEmpty}>
                    لا يوجد أعضاء متاحون لبدء محادثة.
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            type="submit"
            className={styles.startConversationButton}
            disabled={!targetUserId}
          >
            <MessageCirclePlus size={17} />
            بدء المحادثة
          </button>
        </form>
      )}

      <div className={styles.searchBox}>
        <Search size={17} />

        <input
          type="search"
          value={query}
          onChange={(event) =>
            setQuery(
              event.target.value,
            )
          }
          placeholder="ابحث في المحادثات..."
        />
      </div>

      <ChatGroupsInlineSection />

      <div className={styles.sidebarPrivateHeader}>
        <strong>المحادثات الخاصة</strong>

        <span className={styles.sidebarPrivateCount}>
          {filtered.length > 99 ? "99+" : filtered.length}
        </span>
      </div>

      <div className={styles.conversationList}>
        {filtered.length ? (
          filtered.map(
            (item) => {
              const partner =
                item.partner;

              if (!partner) {
                return null;
              }

              const href =
                `/member/chat/${item.id}`;

              const active =
                pathname === href;

              return (
                <Link
                  href={href}
                  key={item.id}
                  className={`${styles.conversationRow}${
                    active
                      ? ` ${styles.conversationRowActive}`
                      : ""
                  }`}
                >
                  <div className={styles.rowAvatar}>
                    {partner.hasAvatar ? (
                      <img
                        src={`/members/${partner.id}/avatar?v=${partner.avatarVersion}`}
                        alt=""
                      />
                    ) : (
                      partner.name
                        .trim()
                        .charAt(0)
                        .toUpperCase()
                    )}
                  </div>

                  <div className={styles.rowMain}>
                    <div className={styles.rowHead}>
                      <strong>
                        {partner.name}
                      </strong>

                      {item.lastMessage && (
                        <time>
                          {formatSidebarTime(
                            item.lastMessage.createdAt,
                          )}
                        </time>
                      )}
                    </div>

                    <span className={styles.rowRole}>
                      {partner.title}

                      {partner.department
                        ? ` · ${partner.department}`
                        : ""}
                    </span>

                    <div className={styles.rowPreview}>
                      <p>
                        {item.lastMessage
                          ? `${item.lastMessage.mine ? "أنت: " : ""}${item.lastMessage.body}`
                          : "لا توجد رسائل بعد"}
                      </p>

                      {item.unreadCount > 0 && (
                        <span className={styles.unreadBadge}>
                          {item.unreadCount > 99
                            ? "99+"
                            : item.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            },
          )
        ) : (
          <div className={styles.sidebarEmpty}>
            لا توجد محادثات مطابقة.
          </div>
        )}
      </div>
    </aside>
  );
}