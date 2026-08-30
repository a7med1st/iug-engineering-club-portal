import {
  Award,
  BadgeCheck,
  CalendarDays,
  MapPin,
  ShieldCheck,
} from "lucide-react";

import {
  notFound,
} from "next/navigation";

import CertificateQr from "@/components/certificates/CertificateQr";

import PrintButton from "@/components/admin/PrintButton";

import {
  getCertificateByCode,
} from "@/lib/certificates";

import styles from "./certificate.module.css";

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

export default async function CertificatePage({
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

  const submission =
    certificate.submission;

  const activity =
    submission.form
      .activity;

  const revoked =
    Boolean(
      certificate.revokedAt,
    );

  return (
    <main
      className={
        styles.shell
      }
      dir="rtl"
    >
      <div
        className={
          styles.toolbar
        }
      >
        <PrintButton />
      </div>

      <article
        className={`${styles.certificate} ${
          revoked
            ? styles.revokedCertificate
            : ""
        }`}
      >
        <header
          className={
            styles.header
          }
        >
          <div
            className={
              styles.brandMark
            }
          >
            <Award
              size={38}
            />
          </div>

          <div>
            <span>
              الجامعة الإسلامية بغزة
            </span>

            <strong>
              النادي الهندسي
            </strong>
          </div>

          <div
            className={
              styles.validity
            }
          >
            {revoked ? (
              <>
                <span>
                  شهادة ملغاة
                </span>
              </>
            ) : (
              <>
                <BadgeCheck
                  size={19}
                />

                <span>
                  شهادة موثقة
                </span>
              </>
            )}
          </div>
        </header>

        <section
          className={
            styles.body
          }
        >
          <span
            className={
              styles.kicker
            }
          >
            Certificate of Participation
          </span>

          <h1>
            شهادة مشاركة
          </h1>

          <p>
            يتشرف النادي الهندسي
            في الجامعة الإسلامية بغزة
            بمنح هذه الشهادة إلى
          </p>

          <h2>
            {
              submission.studentName
            }
          </h2>

          <p>
            تقديرًا لمشاركته وحضوره
            في فعالية
          </p>

          <h3>
            {
              activity.title
            }
          </h3>

          <div
            className={
              styles.details
            }
          >
            <span>
              <CalendarDays
                size={17}
              />

              {formatDate(
                activity.startsAt,
              )}
            </span>

            <span>
              <MapPin
                size={17}
              />

              {
                activity.location
              }
            </span>
          </div>

          {submission.studentDepartment && (
            <p
              className={
                styles.department
              }
            >
              {
                submission.studentDepartment
              }
            </p>
          )}
        </section>

        <footer
          className={
            styles.footer
          }
        >
          <div
            className={
              styles.verify
            }
          >
            <CertificateQr
              code={
                certificate.verificationCode
              }
              size={
                112
              }
            />

            <div>
              <span>
                رمز التحقق
              </span>

              <strong>
                {
                  certificate.verificationCode
                }
              </strong>

              <small>
                امسح QR أو استخدم
                رمز التحقق للتأكد من
                صحة الشهادة.
              </small>
            </div>
          </div>

          <div
            className={
              styles.issued
            }
          >
            <ShieldCheck
              size={20}
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
        </footer>

        {revoked && (
          <div
            className={
              styles.revokedStamp
            }
          >
            ملغاة
          </div>
        )}
      </article>
    </main>
  );
}
