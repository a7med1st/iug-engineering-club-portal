import Link from "next/link";

import {
  CircleX,
  Search,
} from "lucide-react";

import styles from "./verify.module.css";

export default function CertificateNotFound() {
  return (
    <main
      className={
        styles.page
      }
      dir="rtl"
    >
      <section
        className={
          styles.card
        }
      >
        <div
          className={`${styles.statusIcon} ${styles.invalid}`}
        >
          <CircleX
            size={44}
          />
        </div>

        <span
          className={
            styles.eyebrow
          }
        >
          Certificate Verification
        </span>

        <h1>
          لم يتم العثور على الشهادة
        </h1>

        <p>
          رمز التحقق غير صحيح أو لا
          توجد شهادة مسجلة بهذا الرمز.
        </p>

        <Link
          href="/certificates/verify"
        >
          <Search
            size={16}
          />

          جرّب رمزًا آخر
        </Link>
      </section>
    </main>
  );
}
