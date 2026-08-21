import {
  BadgeCheck,
  Ban,
  CalendarDays,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import Link from "next/link";

import {
  notFound,
} from "next/navigation";

import {
  getCertificateByCode,
} from "@/lib/certificates";

import styles from "./verify.module.css";

export const dynamic =
  "force-dynamic";

type Props = {
  params: Promise<{
    code: string;
  }>;
};

function formatDate(
  value: Date,
) {
  return new Intl.DateTimeFormat(
    "ar-PS",
    {
      dateStyle:
        "long",
    },
  ).format(value);
}

export default async function VerifyCertificatePage({
  params,
}: Props) {
  const {
    code,
  } =
    await params;

  const certificate =
    await getCertificateByCode(
      code,
    );

  if (
    !certificate
  ) {
    notFound();
  }

  const activity =
    certificate
      .submission
      .form
      .activity;

  const valid =
    !certificate.revokedAt;

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
          className={`${styles.statusIcon} ${
            valid
              ? styles.valid
              : styles.invalid
          }`}
        >
          {valid ? (
            <BadgeCheck
              size={44}
            />
          ) : (
            <Ban
              size={44}
            />
          )}
        </div>

        <span
          className={
            styles.eyebrow
          }
        >
          Certificate Verification
        </span>

        <h1>
          {valid
            ? "الشهادة صحيحة وموثقة"
            : "هذه الشهادة ملغاة"}
        </h1>

        <p
          className={
            styles.code
          }
        >
          {
            certificate.verificationCode
          }
        </p>

        <div
          className={
            styles.info
          }
        >
          <div>
            <UserRound
              size={18}
            />

            <span>
              اسم المشارك
            </span>

            <strong>
              {
                certificate
                  .submission
                  .studentName
              }
            </strong>
          </div>

          <div>
            <ShieldCheck
              size={18}
            />

            <span>
              النشاط
            </span>

            <strong>
              {
                activity.title
              }
            </strong>
          </div>

          <div>
            <CalendarDays
              size={18}
            />

            <span>
              تاريخ النشاط
            </span>

            <strong>
              {formatDate(
                activity.startsAt,
              )}
            </strong>
          </div>

          <div>
            <CalendarDays
              size={18}
            />

            <span>
              تاريخ الإصدار
            </span>

            <strong>
              {formatDate(
                certificate.issuedAt,
              )}
            </strong>
          </div>
        </div>

        <Link
          href={`/certificates/${certificate.verificationCode}`}
        >
          عرض الشهادة
        </Link>
      </section>
    </main>
  );
}
