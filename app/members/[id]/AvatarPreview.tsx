"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { UserRound, X } from "lucide-react";

import styles from "./member-public.module.css";

type AvatarPreviewProps = {
  src: string | null;
  alt: string;
  initials: string;
};

type ImageRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const animationTiming: KeyframeAnimationOptions = {
  duration: 460,
  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
  fill: "forwards",
};

export default function AvatarPreview({
  src,
  alt,
  initials,
}: AvatarPreviewProps) {
  const [isOpen, setIsOpen] = useState(false);
  const sourceRef = useRef<HTMLButtonElement>(null);
  const previewRef = useRef<HTMLImageElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const sourceRectRef = useRef<ImageRect | null>(null);
  const isClosingRef = useRef(false);
  const hasAnimatedInRef = useRef(false);

  const getTargetRect = useCallback((): ImageRect | null => {
    const preview = previewRef.current;
    if (!preview) return null;

    const naturalWidth = preview.naturalWidth;
    const naturalHeight = preview.naturalHeight;
    if (!naturalWidth || !naturalHeight) return null;

    const maxWidth = Math.max(window.innerWidth - 32, 1);
    const maxHeight = Math.max(window.innerHeight - 48, 1);
    const scale = Math.min(maxWidth / naturalWidth, maxHeight / naturalHeight, 1);
    const width = naturalWidth * scale;
    const height = naturalHeight * scale;

    return {
      left: (window.innerWidth - width) / 2,
      top: (window.innerHeight - height) / 2,
      width,
      height,
    };
  }, []);

  const animateIn = useCallback(() => {
    if (hasAnimatedInRef.current) return;

    const preview = previewRef.current;
    const backdrop = backdropRef.current;
    const sourceRect = sourceRectRef.current;
    const targetRect = getTargetRect();
    if (!preview || !backdrop || !sourceRect || !targetRect) return;

    hasAnimatedInRef.current = true;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const timing = reduceMotion
      ? { ...animationTiming, duration: 1 }
      : animationTiming;

    preview.animate(
      [
        {
          left: `${sourceRect.left}px`,
          top: `${sourceRect.top}px`,
          width: `${sourceRect.width}px`,
          height: `${sourceRect.height}px`,
          borderRadius: "50%",
          opacity: 1,
        },
        {
          left: `${targetRect.left}px`,
          top: `${targetRect.top}px`,
          width: `${targetRect.width}px`,
          height: `${targetRect.height}px`,
          borderRadius: "18px",
          opacity: 1,
        },
      ],
      timing,
    );

    backdrop.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      { ...timing, duration: reduceMotion ? 1 : 280 },
    );
  }, [getTargetRect]);

  const closePreview = useCallback(async () => {
    if (isClosingRef.current) return;

    const preview = previewRef.current;
    const backdrop = backdropRef.current;
    const source = sourceRef.current;
    if (!preview || !backdrop || !source) {
      setIsOpen(false);
      return;
    }

    isClosingRef.current = true;
    const currentRect = preview.getBoundingClientRect();
    const sourceRect = source.getBoundingClientRect();
    preview.getAnimations().forEach((animation) => animation.cancel());
    backdrop.getAnimations().forEach((animation) => animation.cancel());
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const timing = reduceMotion
      ? { ...animationTiming, duration: 1 }
      : { ...animationTiming, duration: 360 };

    const imageAnimation = preview.animate(
      [
        {
          left: `${currentRect.left}px`,
          top: `${currentRect.top}px`,
          width: `${currentRect.width}px`,
          height: `${currentRect.height}px`,
          borderRadius: "18px",
          opacity: 1,
        },
        {
          left: `${sourceRect.left}px`,
          top: `${sourceRect.top}px`,
          width: `${sourceRect.width}px`,
          height: `${sourceRect.height}px`,
          borderRadius: "50%",
          opacity: 1,
        },
      ],
      timing,
    );

    const backdropAnimation = backdrop.animate(
      [{ opacity: 1 }, { opacity: 0 }],
      { ...timing, duration: reduceMotion ? 1 : 260 },
    );

    await Promise.allSettled([
      imageAnimation.finished,
      backdropAnimation.finished,
    ]);

    setIsOpen(false);
    isClosingRef.current = false;
    hasAnimatedInRef.current = false;
    source.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") void closePreview();
    };

    window.addEventListener("keydown", handleKeyDown);
    if (previewRef.current?.complete) animateIn();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [animateIn, closePreview, isOpen]);

  if (!src) {
    return (
      <div className={styles.avatarWrap}>
        <div className={styles.avatarFallback}>
          <UserRound size={34} />
          <strong>{initials}</strong>
        </div>
      </div>
    );
  }

  const openPreview = () => {
    const sourceRect = sourceRef.current?.getBoundingClientRect();
    if (!sourceRect) return;

    sourceRectRef.current = {
      top: sourceRect.top,
      left: sourceRect.left,
      width: sourceRect.width,
      height: sourceRect.height,
    };
    setIsOpen(true);
  };

  return (
    <>
      <button
        ref={sourceRef}
        type="button"
        className={`${styles.avatarWrap} ${styles.avatarButton}`}
        onClick={openPreview}
        aria-label="عرض الصورة الشخصية بالحجم الكامل"
        aria-expanded={isOpen}
      >
        <img src={src} alt={alt} className={styles.avatar} />
      </button>

      {isOpen &&
        createPortal(
          <div
            className={styles.avatarLightbox}
            role="dialog"
            aria-modal="true"
            aria-label="معاينة الصورة الشخصية"
          >
            <div
              ref={backdropRef}
              className={styles.avatarLightboxBackdrop}
              onClick={() => void closePreview()}
            />

            <img
              ref={previewRef}
              src={src}
              alt={alt}
              className={styles.avatarPreviewImage}
              onLoad={animateIn}
            />

            <button
              type="button"
              className={styles.avatarLightboxClose}
              onClick={() => void closePreview()}
              aria-label="إغلاق معاينة الصورة"
              autoFocus
            >
              <X size={22} />
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
