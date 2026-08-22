"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  LoaderCircle,
  Mail,
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

import styles from "./verify-email.module.css";
import {
  EMAIL_VERIFICATION_CODE_LENGTH,
  EMAIL_VERIFICATION_CODE_TTL_MINUTES,
  EMAIL_VERIFICATION_RESEND_SECONDS,
} from "@/lib/email-verification-constants";

type VerifyEmailClientProps = {
  maskedEmail: string;
  initialResendSeconds: number;
  initialDeliveryFailed: boolean;
};

type ApiResponse = {
  error?: string;
  message?: string;
  redirect?: string;
  retryAfterSeconds?: number;
  sessionExpired?: boolean;
};

type Feedback = {
  type: "error" | "success" | "info";
  message: string;
} | null;

export default function VerifyEmailClient({
  maskedEmail,
  initialResendSeconds,
  initialDeliveryFailed,
}: VerifyEmailClientProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [countdown, setCountdown] = useState(
    initialResendSeconds,
  );
  const [verifying, setVerifying] =
    useState(false);
  const [resending, setResending] =
    useState(false);
  const [verified, setVerified] =
    useState(false);
  const [sessionExpired, setSessionExpired] =
    useState(false);
  const [feedback, setFeedback] =
    useState<Feedback>(
      initialDeliveryFailed
        ? {
            type: "error",
            message:
              "تعذر إرسال الرمز أول مرة. يمكنك طلب رمز جديد من الزر أدناه.",
          }
        : null,
    );

  useEffect(() => {
    const countdownActive = countdown > 0;

    if (!countdownActive) return;

    const timer = window.setInterval(() => {
      setCountdown((value) =>
        Math.max(0, value - 1),
      );
    }, 1000);

    return () => window.clearInterval(timer);
  }, [countdown]);

  async function verify(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      code.length !==
      EMAIL_VERIFICATION_CODE_LENGTH
    ) {
      setFeedback({
        type: "error",
        message:
          "يرجى إدخال رمز التحقق المكوّن من 6 أرقام.",
      });
      inputRef.current?.focus();
      return;
    }

    setVerifying(true);
    setFeedback(null);

    try {
      const response = await fetch(
        "/api/auth/verify-email",
        {
          method: "POST",
          headers: {
            "content-type":
              "application/json",
          },
          body: JSON.stringify({ code }),
        },
      );
      const data = (await response
        .json()
        .catch(() => ({}))) as ApiResponse;

      if (!response.ok) {
        setSessionExpired(
          Boolean(data.sessionExpired),
        );
        setFeedback({
          type: "error",
          message:
            data.error ||
            "تعذر التحقق من الرمز. حاول مرة أخرى.",
        });
        setCode("");
        window.setTimeout(
          () => inputRef.current?.focus(),
          0,
        );
        return;
      }

      setVerified(true);
      setFeedback({
        type: "success",
        message:
          "تم تأكيد بريدك الإلكتروني بنجاح.",
      });

      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      window.setTimeout(
        () =>
          router.replace(
            data.redirect ?? "/login?verified=1",
          ),
        reduceMotion ? 0 : 900,
      );
    } catch {
      setFeedback({
        type: "error",
        message:
          "تعذر الاتصال بالخادم. حاول مرة أخرى.",
      });
    } finally {
      setVerifying(false);
    }
  }

  async function resend() {
    if (countdown > 0 || resending) return;

    setResending(true);
    setFeedback(null);

    try {
      const response = await fetch(
        "/api/auth/resend-verification",
        { method: "POST" },
      );
      const data = (await response
        .json()
        .catch(() => ({}))) as ApiResponse;

      if (!response.ok) {
        if (data.retryAfterSeconds) {
          setCountdown(
            data.retryAfterSeconds,
          );
        }
        setSessionExpired(
          Boolean(data.sessionExpired),
        );
        setFeedback({
          type: "error",
          message:
            data.error ||
            "تعذر إرسال رمز جديد. حاول مرة أخرى.",
        });
        return;
      }

      if (data.redirect) {
        router.replace(data.redirect);
        return;
      }

      setCode("");
      setCountdown(
        data.retryAfterSeconds ??
          EMAIL_VERIFICATION_RESEND_SECONDS,
      );
      setFeedback({
        type: "info",
        message:
          data.message ||
          "تم إرسال رمز تحقق جديد إلى بريدك الإلكتروني.",
      });
      inputRef.current?.focus();
    } catch {
      setFeedback({
        type: "error",
        message:
          "تعذر الاتصال بالخادم. حاول مرة أخرى.",
      });
    } finally {
      setResending(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.glow} />
      <section
        className={styles.card}
        aria-labelledby="verify-email-title"
      >
        <div className={styles.accent} />

        <div className={styles.iconWrap}>
          {verified ? (
            <CheckCircle2 aria-hidden="true" />
          ) : (
            <Mail aria-hidden="true" />
          )}
        </div>

        <div className={styles.heading}>
          <ShieldCheck aria-hidden="true" />
          <h1 id="verify-email-title">
            تحقق من بريدك الإلكتروني
          </h1>
        </div>

        <p className={styles.lead}>
          أرسلنا رمز تحقق مكوّنًا من 6 أرقام إلى
          <strong dir="ltr">{maskedEmail}</strong>
        </p>

        <form onSubmit={verify}>
          <label
            className={styles.label}
            htmlFor="verification-code"
          >
            رمز التحقق
          </label>
          <input
            ref={inputRef}
            id="verification-code"
            className={styles.codeInput}
            value={code}
            onChange={(event) =>
              setCode(
                event.currentTarget.value
                  .replace(/\D/g, "")
                  .slice(
                    0,
                    EMAIL_VERIFICATION_CODE_LENGTH,
                  ),
              )
            }
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={
              EMAIL_VERIFICATION_CODE_LENGTH
            }
            autoComplete="one-time-code"
            autoFocus
            dir="ltr"
            placeholder="000000"
            aria-describedby="verification-help"
            disabled={verified || verifying}
          />
          <p
            id="verification-help"
            className={styles.help}
          >
            الرمز صالح لمدة {EMAIL_VERIFICATION_CODE_TTL_MINUTES}{" "}
            دقائق، ويمكنك لصقه كاملًا في الحقل.
          </p>

          <div
            className={styles.feedbackRegion}
            aria-live="polite"
            aria-atomic="true"
          >
            {feedback && (
              <div
                className={`${styles.feedback} ${styles[feedback.type]}`}
                role={
                  feedback.type === "error"
                    ? "alert"
                    : "status"
                }
              >
                {feedback.type === "error" ? (
                  <TriangleAlert aria-hidden="true" />
                ) : (
                  <CheckCircle2 aria-hidden="true" />
                )}
                <span>{feedback.message}</span>
              </div>
            )}
          </div>

          <button
            className={styles.verifyButton}
            type="submit"
            disabled={
              verifying ||
              verified ||
              code.length !==
                EMAIL_VERIFICATION_CODE_LENGTH
            }
          >
            {verifying && (
              <LoaderCircle
                className={styles.spinner}
                aria-hidden="true"
              />
            )}
            {verifying
              ? "جاري التحقق..."
              : verified
                ? "تم تأكيد البريد"
                : "تأكيد البريد الإلكتروني"}
          </button>
        </form>

        <div className={styles.resendArea}>
          <p>
            لم يصلك الرمز؟ تحقق من البريد غير المرغوب
            فيه أولًا.
          </p>
          <button
            className={styles.resendButton}
            type="button"
            onClick={resend}
            disabled={
              countdown > 0 ||
              resending ||
              verifying ||
              verified ||
              sessionExpired
            }
          >
            {resending ? (
              <LoaderCircle
                className={styles.spinner}
                aria-hidden="true"
              />
            ) : (
              <RotateCcw aria-hidden="true" />
            )}
            {resending
              ? "جاري الإرسال..."
              : countdown > 0
                ? `يمكنك طلب رمز جديد بعد ${countdown} ثانية`
                : "إعادة إرسال الرمز"}
          </button>
        </div>

        <Link
          className={styles.loginLink}
          href="/login"
        >
          العودة إلى تسجيل الدخول
        </Link>
      </section>
    </div>
  );
}
