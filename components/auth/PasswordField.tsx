"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

import styles from "./password-flow.module.css";

export default function PasswordField({
  label,
  name,
  autoComplete,
}: {
  label: string;
  name: string;
  autoComplete: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <label className={styles.field}>
      <span>{label}</span>
      <span className={styles.passwordControl}>
        <input
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          minLength={8}
          maxLength={128}
          required
          dir="ltr"
        />
        <button
          type="button"
          className={styles.visibilityButton}
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
          aria-pressed={visible}
        >
          {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </button>
      </span>
    </label>
  );
}
