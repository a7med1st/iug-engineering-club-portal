"use client";

import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import PasswordField from "@/components/auth/PasswordField";
import styles from "@/components/auth/password-flow.module.css";

export default function ChangePasswordForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const data = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          currentPassword: data.get("currentPassword"),
          password: data.get("password"),
          confirmPassword: data.get("confirmPassword"),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error || "تعذر تغيير كلمة المرور.");
        return;
      }
      router.replace(result.redirect || "/member");
      router.refresh();
    } catch {
      setError("تعذر الاتصال بالخادم. حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <PasswordField label="كلمة المرور الحالية" name="currentPassword" autoComplete="current-password" />
      <PasswordField label="كلمة المرور الجديدة" name="password" autoComplete="new-password" />
      <PasswordField label="تأكيد كلمة المرور الجديدة" name="confirmPassword" autoComplete="new-password" />
      <p className={styles.hint}>استخدم من 8 إلى 128 حرفًا، وبكلمة مختلفة عن المؤقتة.</p>
      {error && <p className={`${styles.feedback} ${styles.error}`} role="alert">{error}</p>}
      <button className={styles.button} disabled={loading} type="submit">
        <Save aria-hidden="true" size={19} />
        {loading ? "جارٍ الحفظ..." : "حفظ كلمة المرور والمتابعة"}
      </button>
    </form>
  );
}
