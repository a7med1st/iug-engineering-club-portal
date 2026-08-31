"use client";

import { ArrowLeft, Send } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import styles from "@/components/auth/password-flow.module.css";

export default function ForgotPasswordForm({
  portal,
}: {
  portal: "student" | "member";
}) {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [resetHref, setResetHref] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    const data = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: data.get("email") }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error || "تعذر إكمال الطلب.");
        return;
      }
      setMessage(result.message);
      setResetHref(`${result.redirect}&portal=${portal}`);
    } catch {
      setError("تعذر الاتصال بالخادم. حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form className={styles.form} onSubmit={submit}>
        <label className={styles.field}>
          <span>البريد الإلكتروني</span>
          <input name="email" type="email" autoComplete="email" dir="ltr" required placeholder="name@gmail.com" />
        </label>
        {error && <p className={`${styles.feedback} ${styles.error}`} role="alert">{error}</p>}
        {message && <p className={`${styles.feedback} ${styles.success}`} role="status">{message}</p>}
        <button className={styles.button} disabled={loading} type="submit">
          <Send aria-hidden="true" size={19} />
          {loading ? "جارٍ الإرسال..." : "إرسال رمز الاستعادة"}
        </button>
      </form>
      <div className={styles.actions}>
        {resetHref && <Link className={styles.link} href={resetHref}>لدي رمز الاستعادة</Link>}
        <Link className={styles.link} href={`/login?portal=${portal}`}>
          <ArrowLeft aria-hidden="true" size={17} /> العودة لتسجيل الدخول
        </Link>
      </div>
    </>
  );
}
