"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Bell,
  CalendarDays,
  CheckCheck,
  Info,
  MessageCircle,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import styles from "./notification-bell.module.css";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

type NotificationPayload = {
  ok: boolean;
  unreadCount: number;
  items: NotificationItem[];
};

function relativeTime(value: string) {
  const then = new Date(value).getTime();
  const now = Date.now();

  const diffSeconds = Math.max(
    0,
    Math.floor((now - then) / 1000),
  );

  if (diffSeconds < 45) {
    return "الآن";
  }

  const minutes = Math.floor(diffSeconds / 60);

  if (minutes < 60) {
    return `منذ ${minutes} د`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `منذ ${hours} س`;
  }

  const days = Math.floor(hours / 24);

  if (days < 7) {
    return `منذ ${days} ي`;
  }

  return new Intl.DateTimeFormat("ar-PS", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function NotificationIcon({
  type,
}: {
  type: string;
}) {
  if (type === "CHAT_MESSAGE") {
    return (
      <MessageCircle
        className={styles.notificationIcon}
        aria-hidden="true"
      />
    );
  }

  if (
    type === "ACTIVITY_APPROVED" ||
    type === "ACTIVITY_REJECTED" ||
    type === "ACTIVITY_NEW" ||
    type === "ACTIVITY_REMINDER"
  ) {
    return (
      <CalendarDays
        className={styles.notificationIcon}
        aria-hidden="true"
      />
    );
  }

  return (
    <Info
      className={styles.notificationIcon}
      aria-hidden="true"
    />
  );
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);

  const previousUnreadRef =
    useRef<number | null>(null);

  const toastTimerRef =
    useRef<number | null>(null);

  const audioContextRef =
    useRef<AudioContext | null>(null);

  const soundUnlockedRef =
    useRef(false);

  const unlockSound =
    useCallback(async () => {
      try {
        if (!audioContextRef.current) {
          audioContextRef.current =
            new AudioContext();
        }

        if (
          audioContextRef.current.state ===
          "suspended"
        ) {
          await audioContextRef.current.resume();
        }

        soundUnlockedRef.current =
          audioContextRef.current.state ===
          "running";
      } catch {
        soundUnlockedRef.current =
          false;
      }
    }, []);

  const playNotificationSound =
    useCallback(() => {
      const context =
        audioContextRef.current;

      if (
        !context ||
        !soundUnlockedRef.current ||
        context.state !== "running"
      ) {
        return;
      }

      try {
        const now =
          context.currentTime;

        const master =
          context.createGain();

        master.gain.setValueAtTime(
          0.0001,
          now,
        );

        master.gain.exponentialRampToValueAtTime(
          0.16,
          now + 0.018,
        );

        master.gain.exponentialRampToValueAtTime(
          0.0001,
          now + 0.42,
        );

        master.connect(
          context.destination,
        );

        const first =
          context.createOscillator();

        const second =
          context.createOscillator();

        first.type = "sine";
        second.type = "sine";

        first.frequency.setValueAtTime(
          880,
          now,
        );

        second.frequency.setValueAtTime(
          1174.66,
          now + 0.09,
        );

        const firstGain =
          context.createGain();

        const secondGain =
          context.createGain();

        firstGain.gain.setValueAtTime(
          0.0001,
          now,
        );

        firstGain.gain.exponentialRampToValueAtTime(
          0.8,
          now + 0.015,
        );

        firstGain.gain.exponentialRampToValueAtTime(
          0.0001,
          now + 0.2,
        );

        secondGain.gain.setValueAtTime(
          0.0001,
          now + 0.07,
        );

        secondGain.gain.exponentialRampToValueAtTime(
          0.62,
          now + 0.1,
        );

        secondGain.gain.exponentialRampToValueAtTime(
          0.0001,
          now + 0.34,
        );

        first.connect(firstGain);
        second.connect(secondGain);

        firstGain.connect(master);
        secondGain.connect(master);

        first.start(now);
        first.stop(now + 0.22);

        second.start(now + 0.07);
        second.stop(now + 0.36);
      } catch {
        // Sound must never interrupt notifications.
      }
    }, []);

  const load =
    useCallback(async () => {
      try {
        const response = await fetch(
          "/api/notifications?limit=10",
          {
            cache: "no-store",
          },
        );

        if (!response.ok) {
          return;
        }

        const data =
          (await response.json()) as NotificationPayload;

        const previous =
          previousUnreadRef.current;

        if (
          previous !== null &&
          data.unreadCount > previous &&
          data.items[0]
        ) {
          setToast(
            data.items[0].title,
          );

          playNotificationSound();

          if (
            toastTimerRef.current !==
            null
          ) {
            window.clearTimeout(
              toastTimerRef.current,
            );
          }

          toastTimerRef.current =
            window.setTimeout(
              () => {
                setToast(null);
              },
              4200,
            );
        }

        previousUnreadRef.current =
          data.unreadCount;

        setUnreadCount(
          data.unreadCount,
        );

        setItems(
          data.items,
        );

        setLoaded(true);
      } catch {
        // Notifications must never break the header.
      }
    }, [playNotificationSound]);

  useEffect(() => {
    const handleUnlock =
      () => {
        void unlockSound();
      };

    window.addEventListener(
      "pointerdown",
      handleUnlock,
      {
        once: true,
      },
    );

    window.addEventListener(
      "keydown",
      handleUnlock,
      {
        once: true,
      },
    );

    return () => {
      window.removeEventListener(
        "pointerdown",
        handleUnlock,
      );

      window.removeEventListener(
        "keydown",
        handleUnlock,
      );
    };
  }, [unlockSound]);

  useEffect(() => {
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
        5000,
      );

    const onVisibility =
      () => {
        if (
          document.visibilityState ===
          "visible"
        ) {
          void load();
        }
      };

    document.addEventListener(
      "visibilitychange",
      onVisibility,
    );

    return () => {
      window.clearInterval(
        timer,
      );

      document.removeEventListener(
        "visibilitychange",
        onVisibility,
      );

      if (
        toastTimerRef.current !==
        null
      ) {
        window.clearTimeout(
          toastTimerRef.current,
        );
      }
    };
  }, [load]);

  useEffect(() => {
    return () => {
      if (
        audioContextRef.current
      ) {
        void audioContextRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown =
      (event: PointerEvent) => {
        if (
          rootRef.current &&
          !rootRef.current.contains(
            event.target as Node,
          )
        ) {
          setOpen(false);
        }
      };

    const onKeyDown =
      (event: KeyboardEvent) => {
        if (
          event.key === "Escape"
        ) {
          setOpen(false);
        }
      };

    document.addEventListener(
      "pointerdown",
      onPointerDown,
    );

    document.addEventListener(
      "keydown",
      onKeyDown,
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        onPointerDown,
      );

      document.removeEventListener(
        "keydown",
        onKeyDown,
      );
    };
  }, [open]);

  async function markRead(
    id: string,
  ) {
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              readAt:
                item.readAt ??
                new Date().toISOString(),
            }
          : item,
      ),
    );

    const target =
      items.find(
        (item) =>
          item.id === id,
      );

    if (
      target &&
      !target.readAt
    ) {
      setUnreadCount(
        (value) =>
          Math.max(
            0,
            value - 1,
          ),
      );
    }

    try {
      const response =
        await fetch(
          "/api/notifications",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                id,
              }),
          },
        );

      if (response.ok) {
        const data =
          (await response.json()) as {
            unreadCount: number;
          };

        setUnreadCount(
          data.unreadCount,
        );

        previousUnreadRef.current =
          data.unreadCount;
      }
    } catch {
      void load();
    }
  }

  async function markAllRead() {
    setItems((current) =>
      current.map((item) => ({
        ...item,

        readAt:
          item.readAt ??
          new Date().toISOString(),
      })),
    );

    setUnreadCount(0);

    previousUnreadRef.current =
      0;

    try {
      await fetch(
        "/api/notifications",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              all: true,
            }),
        },
      );
    } catch {
      void load();
    }
  }

  return (
    <div
      className={styles.root}
      ref={rootRef}
    >
      <button
        className={`${styles.bellButton}${
          open
            ? ` ${styles.bellButtonOpen}`
            : ""
        }`}
        type="button"
        aria-label={
          unreadCount
            ? `الإشعارات، ${unreadCount} غير مقروء`
            : "الإشعارات"
        }
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls="notifications-dropdown"
        onClick={() => {
          void unlockSound();

          setOpen(
            (value) =>
              !value,
          );

          if (!open) {
            void load();
          }
        }}
      >
        <Bell aria-hidden="true" />

        {unreadCount > 0 && (
          <span
            className={styles.badge}
          >
            {unreadCount > 99
              ? "99+"
              : unreadCount}
          </span>
        )}
      </button>

      {toast && !open && (
        <div
          className={styles.toast}
          role="status"
        >
          <MessageCircle
            aria-hidden="true"
          />

          <span>
            {toast}
          </span>
        </div>
      )}

      <section
        id="notifications-dropdown"
        className={styles.dropdown}
        data-state={open ? "open" : "closed"}
        role="dialog"
        aria-label="قائمة الإشعارات"
        aria-hidden={!open}
      >
          <div
            className={styles.dropdownHeader}
          >
            <div>
              <h2>
                الإشعارات
              </h2>
            </div>

            {unreadCount > 0 && (
              <button
                className={styles.markAll}
                type="button"
                onClick={() =>
                  void markAllRead()
                }
              >
                <CheckCheck
                  aria-hidden="true"
                />

                تحديد الكل كمقروء
              </button>
            )}
          </div>

          <div className={styles.list}>
            {!loaded ? (
              <div className={styles.empty}>
                جار تحميل الإشعارات...
              </div>
            ) : items.length ? (
              items.map((item) => {
                const content = (
                  <>
                    <span
                      className={`${styles.iconBox} ${
                        item.type === "CHAT_MESSAGE"
                          ? styles.iconChat
                          : ""
                      }`}
                    >
                      <NotificationIcon
                        type={item.type}
                      />
                    </span>

                    <span
                      className={styles.content}
                    >
                      <strong>
                        {item.title}
                      </strong>

                      {item.body && (
                        <span
                          className={styles.body}
                        >
                          {item.body}
                        </span>
                      )}

                      <small>
                        {relativeTime(
                          item.createdAt,
                        )}
                      </small>
                    </span>

                    {!item.readAt && (
                      <span
                        className={styles.unreadDot}
                        aria-label="غير مقروء"
                      />
                    )}
                  </>
                );

                const className =
                  `${styles.item}${
                    !item.readAt
                      ? ` ${styles.unread}`
                      : ""
                  }`;

                if (item.href) {
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      className={className}
                      onClick={() => {
                        void markRead(
                          item.id,
                        );

                        setOpen(false);
                      }}
                    >
                      {content}
                    </Link>
                  );
                }

                return (
                  <button
                    key={item.id}
                    type="button"
                    className={className}
                    onClick={() =>
                      void markRead(
                        item.id,
                      )
                    }
                  >
                    {content}
                  </button>
                );
              })
            ) : (
              <div className={styles.empty}>
                <Bell aria-hidden="true" />

                <strong>
                  لا توجد إشعارات حتى الآن
                </strong>

                <span>
                  ستظهر الرسائل والتنبيهات الجديدة هنا.
                </span>
              </div>
            )}
          </div>

          <Link
            href="/notifications"
            className={styles.allLink}
            onClick={() =>
              setOpen(false)
            }
          >
            <span>عرض كل الإشعارات</span>
            <ArrowLeft aria-hidden="true" />
          </Link>
      </section>
    </div>
  );
}
