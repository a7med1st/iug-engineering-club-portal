"use client";

import { CircleHelp, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getLoginGuideDevice,
  getLoginGuideStartStep,
  getLoginGuideStorageKey,
  type LoginGuideStep,
  shouldAutoStartLoginGuide,
} from "@/lib/login-guide";

type TargetRect = Pick<DOMRect, "top" | "left" | "width" | "height" | "bottom">;
type GuideDialogStyle = CSSProperties & { "--login-guide-arrow-left": string };

const stepContent: Record<LoginGuideStep, { title: string; description: string }> = {
  "desktop-login": {
    title: "ابدأ من هنا",
    description: "اضغط على زر تسجيل الدخول للوصول إلى حسابك الطلابي.",
  },
  "mobile-menu": {
    title: "افتح قائمة الموقع",
    description: "زر تسجيل الدخول موجود داخل القائمة على الجوال.",
  },
  "mobile-login": {
    title: "تسجيل الدخول",
    description: "من هنا تنتقل إلى صفحة دخول الطالب.",
  },
  portal: {
    title: "اختر طالب",
    description: "تأكد أن خيار طالب محدد قبل كتابة بيانات حسابك.",
  },
  credentials: {
    title: "أدخل بياناتك",
    description: "اكتب بريدك وكلمة المرور، ثم اضغط دخول. يمكنك استخدام نسيت كلمة المرور عند الحاجة.",
  },
};

export default function LoginGuide({ authenticated }: { authenticated: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [step, setStep] = useState<LoginGuideStep | null>(null);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const isMobile = useCallback(
    () => window.matchMedia("(max-width: 1100px)").matches,
    [],
  );

  const startGuide = useCallback(() => {
    setStep(getLoginGuideStartStep({ mobile: isMobile(), pathname }));
  }, [isMobile, pathname]);

  const currentStorageKey = useCallback(
    () => getLoginGuideStorageKey(getLoginGuideDevice(window.innerWidth)),
    [],
  );

  useEffect(() => {
    if (authenticated) return;

    let completed = false;
    try {
      completed = window.localStorage.getItem(currentStorageKey()) === "1";
    } catch {
      // The guide still works when privacy settings block local storage.
    }
    if (!shouldAutoStartLoginGuide({ authenticated, completed })) return;

    const timer = window.setTimeout(startGuide, 4100);
    return () => window.clearTimeout(timer);
  }, [authenticated, currentStorageKey, startGuide]);

  useEffect(() => {
    if (!step) return;

    const updateTarget = () => {
      const target = document.querySelector<HTMLElement>(`[data-login-guide="${step}"]`);
      if (!target) {
        setTargetRect(null);
        return;
      }
      const rect = target.getBoundingClientRect();
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        bottom: rect.bottom,
      });
    };

    updateTarget();
    const observer = new MutationObserver(updateTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", updateTarget);
    window.addEventListener("scroll", updateTarget, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateTarget);
      window.removeEventListener("scroll", updateTarget, true);
    };
  }, [step, pathname]);

  useEffect(() => {
    if (!step || !targetRect) return;
    dialogRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setStep(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [step, targetRect]);

  function finishGuide() {
    try {
      window.localStorage.setItem(currentStorageKey(), "1");
    } catch {
      // Closing the guide must not depend on storage availability.
    }
    setStep(null);
  }

  function nextStep() {
    if (!step) return;
    if (step === "mobile-menu") {
      document.querySelector<HTMLElement>('[data-login-guide="mobile-menu"]')?.click();
      window.setTimeout(() => setStep("mobile-login"), 180);
      return;
    }
    if (step === "desktop-login" || step === "mobile-login") {
      setStep("portal");
      router.push("/login");
      return;
    }
    if (step === "portal") {
      setStep("credentials");
      return;
    }
    finishGuide();
  }

  function previousStep() {
    if (step === "credentials") setStep("portal");
    else if (step === "mobile-login") setStep("mobile-menu");
  }

  const progress = useMemo(() => {
    if (step === "desktop-login" || step === "mobile-menu" || step === "mobile-login") return "1 من 3";
    if (step === "portal") return "2 من 3";
    return "3 من 3";
  }, [step]);

  const canGoBack = step === "credentials" || step === "mobile-login";
  const isLast = step === "credentials";
  const tooltipBelow = !targetRect || targetRect.top < 230;
  const tooltipStyle = useMemo<GuideDialogStyle | undefined>(() => {
    if (!targetRect) return undefined;

    const margin = 14;
    const width = Math.min(380, window.innerWidth - margin * 2);
    const targetCenter = targetRect.left + targetRect.width / 2;
    const left = Math.min(
      window.innerWidth - margin - width / 2,
      Math.max(margin + width / 2, targetCenter),
    );
    const arrowLeft = Math.min(width - 24, Math.max(24, targetCenter - (left - width / 2)));

    return {
      left,
      "--login-guide-arrow-left": `${arrowLeft}px`,
      ...(tooltipBelow
        ? { top: Math.max(16, Math.min(targetRect.bottom + 22, window.innerHeight - 250)) }
        : { bottom: Math.max(window.innerHeight - targetRect.top + 22, 18) }),
    };
  }, [targetRect, tooltipBelow]);

  if (authenticated) return null;

  return (
    <>
      <button
        className="login-guide-help"
        type="button"
        aria-label="شرح تسجيل الدخول"
        title="شرح تسجيل الدخول"
        onClick={startGuide}
      >
        <CircleHelp aria-hidden="true" />
      </button>

      {step && targetRect && (
        <div className="login-guide-layer" role="presentation">
          <div className="login-guide-backdrop" />
          <div
            className="login-guide-highlight"
            style={{
              top: targetRect.top - 7,
              left: targetRect.left - 7,
              width: targetRect.width + 14,
              height: targetRect.height + 14,
            }}
          />
          <div
            ref={dialogRef}
            className={`login-guide-dialog ${tooltipBelow ? "is-below" : "is-above"}`}
            style={tooltipStyle}
            role="dialog"
            aria-modal="true"
            aria-labelledby="login-guide-title"
            tabIndex={-1}
          >
            <div className="login-guide-dialog-head">
              <span>{progress}</span>
              <button type="button" onClick={() => setStep(null)} aria-label="إغلاق الشرح">
                <X aria-hidden="true" />
              </button>
            </div>
            <h2 id="login-guide-title">{stepContent[step].title}</h2>
            <p>{stepContent[step].description}</p>
            <div className="login-guide-actions">
              {canGoBack && (
                <button className="ghost-btn" type="button" onClick={previousStep}>السابق</button>
              )}
              <button className="primary-btn" type="button" onClick={nextStep}>
                {isLast ? "فهمت" : "التالي"}
              </button>
            </div>
            <button className="login-guide-skip" type="button" onClick={finishGuide}>تخطي الشرح</button>
          </div>
        </div>
      )}
    </>
  );
}
