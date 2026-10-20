"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import styles from "@/app/activities/[id]/activity-details.module.css";

type GalleryImage = {
  id: string;
  url: string;
};

export default function ActivityGallery({
  images,
  activityTitle,
  layout = "default",
}: {
  images: GalleryImage[];
  activityTitle: string;
  layout?: "default" | "story";
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const isOpen = activeIndex !== null;
  const activeImage = activeIndex === null ? null : images[activeIndex];

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Tab") {
        const controls = dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not([tabindex='-1'])");
        if (!controls?.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
      if (event.key === "Escape") setActiveIndex(null);

      if (event.key === "ArrowLeft" && images.length > 1) {
        setActiveIndex((current) =>
          current === null ? null : (current + 1) % images.length,
        );
      }

      if (event.key === "ArrowRight" && images.length > 1) {
        setActiveIndex((current) =>
          current === null
            ? null
            : (current - 1 + images.length) % images.length,
        );
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      triggerRef.current?.focus();
    };
  }, [isOpen, images.length]);

  function previous() {
    setActiveIndex((current) =>
      current === null ? null : (current - 1 + images.length) % images.length,
    );
  }

  function next() {
    setActiveIndex((current) =>
      current === null ? null : (current + 1) % images.length,
    );
  }

  return (
    <>
      <div className={`${styles.galleryGrid} ${layout === "story" ? styles.galleryStoryGrid : ""}`}>
        {images.map((image, index) => (
          <button
            className={styles.galleryItem}
            key={image.id}
            type="button"
            onClick={(event) => { triggerRef.current = event.currentTarget; setActiveIndex(index); }}
            aria-label={`عرض الصورة ${index + 1} من فعالية ${activityTitle}`}
          >
            <img
              src={image.url}
              alt={`صورة ${index + 1} من فعالية ${activityTitle}`}
              loading="lazy"
            />
            <span aria-hidden="true">عرض الصورة</span>
          </button>
        ))}
      </div>

      {activeImage && activeIndex !== null && createPortal(
        <div
          ref={dialogRef}
          className={styles.lightbox}
          role="dialog"
          aria-modal="true"
          aria-label={`معرض صور ${activityTitle}`}
        >
          <button
            className={styles.lightboxBackdrop}
            type="button"
            tabIndex={-1}
            aria-label="إغلاق معرض الصور"
            onClick={() => setActiveIndex(null)}
          />

          <div className={styles.lightboxContent}>
            <button
              ref={closeButtonRef}
              className={styles.lightboxClose}
              type="button"
              onClick={() => setActiveIndex(null)}
              aria-label="إغلاق"
            >
              <X aria-hidden="true" />
            </button>

            <img
              src={activeImage.url}
              alt={`صورة ${activeIndex + 1} من فعالية ${activityTitle}`}
            />

            <span className={styles.lightboxCounter}>
              {activeIndex + 1} / {images.length}
            </span>

            {images.length > 1 && (
              <>
                <button
                  className={`${styles.lightboxArrow} ${styles.lightboxPrevious}`}
                  type="button"
                  onClick={previous}
                  aria-label="الصورة السابقة"
                >
                  <ChevronRight aria-hidden="true" />
                </button>
                <button
                  className={`${styles.lightboxArrow} ${styles.lightboxNext}`}
                  type="button"
                  onClick={next}
                  aria-label="الصورة التالية"
                >
                  <ChevronLeft aria-hidden="true" />
                </button>
              </>
            )}
          </div>
        </div>, document.body
      )}
    </>
  );
}
