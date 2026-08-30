"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import styles from "./AdminFeedback.module.css";

export default function AdminFeedback({
  error,
  success,
}: {
  error?: string;
  success?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const message = error ?? success;
  const [visible, setVisible] = useState(Boolean(message));
  const [hiding, setHiding] = useState(false);

  useEffect(() => {
    if (!message) {
      setVisible(false);
      setHiding(false);
      return;
    }

    setVisible(true);
    setHiding(false);

    const hideTimer = window.setTimeout(() => {
      setHiding(true);

      const removeTimer = window.setTimeout(() => {
        setVisible(false);

        // امسح رسالة success/error من الرابط حتى لا ترجع بعد Refresh.
        const params = new URLSearchParams(searchParams.toString());
        params.delete("success");
        params.delete("error");

        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname, {
          scroll: false,
        });
      }, 280);

      return () => window.clearTimeout(removeTimer);
    }, 5000);

    return () => window.clearTimeout(hideTimer);
  }, [message, pathname, router, searchParams]);

  if (!message || !visible) return null;

  return (
    <div
      className={`${error ? "form-error" : "form-success"} admin-feedback ${styles.feedback} ${
        hiding ? styles.hiding : ""
      }`}
      role={error ? "alert" : "status"}
      aria-live={error ? "assertive" : "polite"}
    >
      <span>{message}</span>

      <button
        type="button"
        className={styles.close}
        aria-label="إغلاق الإشعار"
        title="إغلاق"
        onClick={() => {
          setHiding(true);
          window.setTimeout(() => {
            setVisible(false);

            const params = new URLSearchParams(searchParams.toString());
            params.delete("success");
            params.delete("error");
            const query = params.toString();

            router.replace(query ? `${pathname}?${query}` : pathname, {
              scroll: false,
            });
          }, 220);
        }}
      >
        <span className={styles.closeIcon} aria-hidden="true">
          <span />
          <span />
        </span>
      </button>

      <span className={styles.progress} aria-hidden="true" />
    </div>
  );
}
