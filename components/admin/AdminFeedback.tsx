"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

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
      className={`${error ? "form-error" : "form-success"} admin-feedback auto-dismiss-feedback ${
        hiding ? "is-hiding" : ""
      }`}
      role={error ? "alert" : "status"}
      aria-live={error ? "assertive" : "polite"}
    >
      <span>{message}</span>

      <button
        type="button"
        className="auto-dismiss-feedback-close"
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
        <span className="auto-dismiss-feedback-close-icon" aria-hidden="true">
          <span />
          <span />
        </span>
      </button>

      <span className="auto-dismiss-feedback-progress" aria-hidden="true" />

      <style jsx>{`
        .auto-dismiss-feedback {
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding-inline-end: 48px;
          opacity: 1;
          transform: translateY(0);
          transition:
            opacity 0.28s ease,
            transform 0.28s ease;
        }

        .auto-dismiss-feedback.is-hiding {
          opacity: 0;
          transform: translateY(-6px);
        }

        .auto-dismiss-feedback-close {
          position: absolute;
          inset-inline-end: 12px;
          top: 50%;
          width: 34px;
          height: 34px;
          padding: 0;
          display: grid;
          place-items: center;
          border: 1px solid rgba(24, 86, 53, 0.22);
          border-radius: 999px;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(244, 251, 246, 0.95));
          color: #2d7f52;
          cursor: pointer;
          box-shadow:
            0 6px 16px rgba(34, 111, 68, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.96);
          transform: translateY(-50%);
          transition:
            background 0.22s ease,
            border-color 0.22s ease,
            box-shadow 0.22s ease,
            transform 0.22s ease;
        }

        .auto-dismiss-feedback-close:hover {
          border-color: rgba(24, 136, 255, 0.24);
          background: linear-gradient(135deg, rgba(255,255,255,0.98), rgba(236, 247, 255, 0.98));
          box-shadow:
            0 10px 22px rgba(22, 136, 255, 0.12),
            inset 0 1px 0 rgba(255, 255, 255, 0.98);
          transform: translateY(-50%) scale(1.05);
        }

        .auto-dismiss-feedback-close:active {
          transform: translateY(-50%) scale(0.97);
        }

        .auto-dismiss-feedback-close-icon {
          position: relative;
          width: 14px;
          height: 14px;
          display: block;
        }

        .auto-dismiss-feedback-close-icon span {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 14px;
          height: 2px;
          border-radius: 999px;
          background: currentColor;
          transform-origin: center;
          transition: transform 0.22s ease, background 0.22s ease;
        }

        .auto-dismiss-feedback-close-icon span:first-child {
          transform: translate(-50%, -50%) rotate(45deg);
        }

        .auto-dismiss-feedback-close-icon span:last-child {
          transform: translate(-50%, -50%) rotate(-45deg);
        }

        .auto-dismiss-feedback-close:hover .auto-dismiss-feedback-close-icon span:first-child {
          transform: translate(-50%, -50%) rotate(50deg);
        }

        .auto-dismiss-feedback-close:hover .auto-dismiss-feedback-close-icon span:last-child {
          transform: translate(-50%, -50%) rotate(-50deg);
        }

        .auto-dismiss-feedback-progress {
          position: absolute;
          inset-inline-start: 0;
          bottom: 0;
          width: 100%;
          height: 3px;
          background: currentColor;
          opacity: 0.28;
          transform-origin: right center;
          animation: feedbackCountdown 5s linear forwards;
        }

        @keyframes feedbackCountdown {
          from {
            transform: scaleX(1);
          }
          to {
            transform: scaleX(0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .auto-dismiss-feedback,
          .auto-dismiss-feedback-close,
          .auto-dismiss-feedback-progress {
            transition: none;
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}