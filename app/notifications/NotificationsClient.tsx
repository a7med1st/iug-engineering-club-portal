"use client";

import Link from "next/link";
import {
  Bell,
  CalendarDays,
  CheckCheck,
  Info,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
} from "react";

import styles from "./notifications.module.css";

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
  hasMore: boolean;
  nextCursor: string | null;
};

function formatDate(
  value: string,
) {
  return new Intl.DateTimeFormat(
    "ar-PS",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(
    new Date(value),
  );
}

function Icon({
  type,
}: {
  type: string;
}) {
  if (
    type ===
      "ACTIVITY_APPROVED" ||
    type ===
      "ACTIVITY_REJECTED" ||
    type ===
      "ACTIVITY_NEW" ||
    type ===
      "ACTIVITY_REMINDER"
  ) {
    return (
      <CalendarDays
        className={
          styles.notificationIcon
        }
        aria-hidden="true"
      />
    );
  }

  return (
    <Info
      className={
        styles.notificationIcon
      }
      aria-hidden="true"
    />
  );
}

export default function NotificationsClient() {
  const [items, setItems] =
    useState<
      NotificationItem[]
    >([]);

  const [
    unreadCount,
    setUnreadCount,
  ] = useState(0);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    loadingMore,
    setLoadingMore,
  ] = useState(false);

  const [
    hasMore,
    setHasMore,
  ] = useState(false);

  const [
    nextCursor,
    setNextCursor,
  ] = useState<
    string | null
  >(null);

  const [
    loadError,
    setLoadError,
  ] = useState<
    string | null
  >(null);

  const load =
    useCallback(
      async () => {
        try {
          const response =
            await fetch(
              "/api/notifications?limit=50",
              {
                cache:
                  "no-store",
              },
            );

          if (
            !response.ok
          ) {
            return;
          }

          const data =
            (await response.json()) as
              NotificationPayload;

          setItems(
            data.items,
          );

          setUnreadCount(
            data.unreadCount,
          );

          setHasMore(
            data.hasMore,
          );

          setNextCursor(
            data.nextCursor,
          );
        } finally {
          setLoading(false);
        }
      },
      [],
    );

  useEffect(() => {
    void load();
  }, [load]);

  async function loadOlder() {
    if (
      !hasMore ||
      !nextCursor ||
      loadingMore
    ) {
      return;
    }

    setLoadingMore(true);
    setLoadError(null);

    try {
      const response =
        await fetch(
          `/api/notifications?limit=50&before=${encodeURIComponent(
            nextCursor,
          )}`,
          {
            cache:
              "no-store",
          },
        );

      if (!response.ok) {
        throw new Error(
          "LOAD_FAILED",
        );
      }

      const data =
        (await response.json()) as
          NotificationPayload;

      setItems(
        (current) => {
          const byId =
            new Map<
              string,
              NotificationItem
            >();

          for (
            const item
            of current
          ) {
            byId.set(
              item.id,
              item,
            );
          }

          for (
            const item
            of data.items
          ) {
            byId.set(
              item.id,
              item,
            );
          }

          return Array.from(
            byId.values(),
          ).sort(
            (
              first,
              second,
            ) => {
              const timeDiff =
                new Date(
                  second.createdAt,
                ).getTime() -
                new Date(
                  first.createdAt,
                ).getTime();

              if (
                timeDiff !== 0
              ) {
                return timeDiff;
              }

              return second.id.localeCompare(
                first.id,
              );
            },
          );
        },
      );

      setHasMore(
        data.hasMore,
      );

      setNextCursor(
        data.nextCursor,
      );

      setUnreadCount(
        data.unreadCount,
      );
    } catch {
      setLoadError(
        "تعذر تحميل الإشعارات السابقة. حاول مرة أخرى.",
      );
    } finally {
      setLoadingMore(false);
    }
  }

  async function markRead(
    id: string,
  ) {
    const target =
      items.find(
        (item) =>
          item.id === id,
      );

    const wasUnread =
      Boolean(
        target &&
        !target.readAt,
      );

    setItems(
      (current) =>
        current.map(
          (item) =>
            item.id === id
              ? {
                  ...item,

                  readAt:
                    item.readAt ??
                    new Date()
                      .toISOString(),
                }
              : item,
        ),
    );

    if (wasUnread) {
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
            unreadCount:
              number;
          };

        setUnreadCount(
          data.unreadCount,
        );
      }
    } catch {
      void load();
    }
  }

  async function markAllRead() {
    const now =
      new Date()
        .toISOString();

    setItems(
      (current) =>
        current.map(
          (item) => ({
            ...item,

            readAt:
              item.readAt ??
              now,
          }),
        ),
    );

    setUnreadCount(0);

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
    <main
      className={
        styles.page
      }
    >
      <section
        className={
          styles.hero
        }
      >
        <div
          className={
            styles.heroIcon
          }
        >
          <Bell
            aria-hidden="true"
          />
        </div>

        <div>
          <h1>
            الإشعارات
          </h1>

          <p>
            تابع التنبيهات المهمة
            من مكان واحد.
          </p>
        </div>

        {unreadCount >
          0 && (
          <button
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
      </section>

      <section
        className={
          styles.panel
        }
      >
        <div
          className={
            styles.panelHead
          }
        >
          <div>
            <strong>
              كل الإشعارات
            </strong>

            <span>
              {unreadCount
                ? `${unreadCount} غير مقروء`
                : "لا توجد إشعارات غير مقروءة"}
            </span>
          </div>
        </div>

        {loading ? (
          <div
            className={
              styles.empty
            }
          >
            جار تحميل الإشعارات...
          </div>
        ) : items.length ? (
          <>
            <div
              className={
                styles.list
              }
            >
              {items.map(
                (item) => {
                  const content = (
                    <>
                      <span
                        className={
                          styles.iconBox
                        }
                      >
                        <Icon
                          type={
                            item.type
                          }
                        />
                      </span>

                      <span
                        className={
                          styles.content
                        }
                      >
                        <strong>
                          {
                            item.title
                          }
                        </strong>

                        {item.body && (
                          <span>
                            {
                              item.body
                            }
                          </span>
                        )}

                        <small>
                          {formatDate(
                            item.createdAt,
                          )}
                        </small>
                      </span>

                      {!item.readAt && (
                        <span
                          className={
                            styles.unreadDot
                          }
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

                  if (
                    item.href
                  ) {
                    return (
                      <Link
                        key={
                          item.id
                        }
                        href={
                          item.href
                        }
                        className={
                          className
                        }
                        onClick={() =>
                          void markRead(
                            item.id,
                          )
                        }
                      >
                        {
                          content
                        }
                      </Link>
                    );
                  }

                  return (
                    <button
                      key={
                        item.id
                      }
                      type="button"
                      className={
                        className
                      }
                      onClick={() =>
                        void markRead(
                          item.id,
                        )
                      }
                    >
                      {content}
                    </button>
                  );
                },
              )}
            </div>

            {hasMore && (
              <div
                style={{
                  display:
                    "flex",
                  justifyContent:
                    "center",
                  padding:
                    "20px 16px",
                }}
              >
                <button
                  type="button"
                  className="ghost-btn"
                  disabled={
                    loadingMore
                  }
                  onClick={() =>
                    void loadOlder()
                  }
                >
                  {loadingMore
                    ? "جار تحميل الإشعارات السابقة..."
                    : "تحميل الإشعارات السابقة"}
                </button>
              </div>
            )}

            {loadError && (
              <div
                role="alert"
                style={{
                  textAlign:
                    "center",
                  padding:
                    "0 16px 18px",
                }}
              >
                <small>
                  {loadError}
                </small>
              </div>
            )}
          </>
        ) : (
          <div
            className={
              styles.empty
            }
          >
            <Bell
              aria-hidden="true"
            />

            <strong>
              صندوق الإشعارات فارغ
            </strong>

            <span>
              عند وصول تنبيه جديد
              سيظهر هنا.
            </span>
          </div>
        )}
      </section>
    </main>
  );
}
