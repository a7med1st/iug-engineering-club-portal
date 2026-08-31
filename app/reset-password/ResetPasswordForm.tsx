"use client";

import { RotateCw, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import PasswordField from "@/components/auth/PasswordField";
import styles from "@/components/auth/password-flow.module.css";

export default function ResetPasswordForm({
  initialEmail,
  portal,
}: {
  initialEmail: string;
  portal: "student" | "member";
}) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [remaining, setRemaining] = useState(initialEmail ? 60 : 0);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = window.setInterval(
      () => setRemaining((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [remaining]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    const data = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          code: data.get("code"),
          password: data.get("password"),
          confirmPassword: data.get("confirmPassword"),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error || "تعذر تغيير كلمة المرور.");
        return;
      }
      router.replace(result.redirect || `/login?portal=${portal}&passwordReset=success`);
      router.refresh();
    } catch {
      setError("تعذر الاتصال بالخادم. حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    if (remaining > 0 || !email) return;
    setError("");
    setMessage("");
    setResending(true);
    try {
      const response = await fetch("/api/auth/resend-reset-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error || "تعذر إعادة إرسال الرمز.");
        if (result.retryAfterSeconds) setRemaining(result.retryAfterSeconds);
        return;
      }
      setMessage(result.message);
      setRemaining(result.retryAfterSeconds || 60);
    } catch {
      setError("تعذر الاتصال بالخادم. حاول مرة أخرى.");
    } finally {
      setResending(false);
    }
  }

  return (
    <>
      <form className={styles.form} onSubmit={submit}>
        <label className={styles.field}>
          <span>البريد الإلكتروني</span>
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" dir="ltr" required />
        </label>
        <label className={styles.field}>
          <span>رمز الاستعادة</span>
          <input className={styles.codeInput} name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required dir="ltr" />
        </label>
        <PasswordField label="كلمة المرور الجديدة" name="password" autoComplete="new-password" />
        <PasswordField label="تأكيد كلمة المرور" name="confirmPassword" autoComplete="new-password" />
        {error && <p className={`${styles.feedback} ${styles.error}`} role="alert">{error}</p>}
        {message && <p className={`${styles.feedback} ${styles.success}`} role="status">{message}</p>}
        <button className={styles.button} disabled={loading} type="submit">
          <Save aria-hidden="true" size={19} />
          {loading ? "جارٍ الحفظ..." : "حفظ كلمة المرور الجديدة"}
        </button>
      </form>
      <div className={styles.actions}>
        <button className={styles.resend} disabled={resending || remaining > 0 || !email} onClick={resend} type="button">
          <RotateCw aria-hidden="true" size={17} />
          {remaining > 0 ? `إعادة الإرسال بعد ${remaining} ث` : resending ? "جارٍ الإرسال..." : "إعادة إرسال الرمز"}
        </button>
      </div>
    </>
  );
}
