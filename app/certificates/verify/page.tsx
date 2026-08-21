import {
  redirect,
} from "next/navigation";

import {
  Award,
  Search,
  ShieldCheck,
} from "lucide-react";

import {
  normalizeCertificateCode,
} from "@/lib/certificates";

import styles from "./verify-home.module.css";

export const dynamic =
  "force-dynamic";

type Props = {
  searchParams: Promise<{
    code?:
      | string
      | string[];

    error?:
      | string
      | string[];
  }>;
};

function one(
  value:
    | string
    | string[]
    | undefined,
) {
  return Array.isArray(value)
    ? value[0]
    : value;
}

export default async function CertificateVerifyHome({
  searchParams,
}: Props) {
  const params =
    await searchParams;

  const rawCode =
    one(
      params.code,
    );

  if (
    rawCode
  ) {
    const code =
      normalizeCertificateCode(
        rawCode,
      );

    if (
      code
    ) {
      redirect(
        `/certificates/verify/${encodeURIComponent(
          code,
        )}`,
      );
    }
  }

  const error =
    one(
      params.error,
    );

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
          className={
            styles.icon
          }
        >
          <ShieldCheck
            size={38}
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
          التحقق من الشهادات
        </h1>

        <p>
          أدخل رمز التحقق الموجود
          أسفل الشهادة للتأكد من
          صحتها وحالتها الحالية.
        </p>

        {error && (
          <div
            className={
              styles.error
            }
          >
            {error}
          </div>
        )}

        <form
          method="get"
          action="/certificates/verify"
        >
          <label
            htmlFor="certificate-code"
          >
            رمز التحقق
          </label>

          <div
            className={
              styles.inputRow
            }
          >
            <Award
              size={18}
              aria-hidden="true"
            />

            <input
              id="certificate-code"
              name="code"
              type="text"
              dir="ltr"
              autoComplete="off"
              placeholder="EC-2026-XXXXXXXXXXXX"
              required
              maxLength={40}
            />
          </div>

          <button
            type="submit"
          >
            <Search
              size={17}
            />

            تحقق من الشهادة
          </button>
        </form>

        <small>
          يمكن أيضًا مسح رمز QR
          الموجود على الشهادة للوصول
          مباشرة إلى نتيجة التحقق.
        </small>
      </section>
    </main>
  );
}
