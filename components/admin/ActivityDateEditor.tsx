"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, CheckCircle2, Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  updateActivityDate,
  type UpdateActivityDateState,
} from "@/app/admin/activities/[id]/registrations/actions";
import ActivitySchedulePicker from "./ActivitySchedulePicker";

import styles from "./ActivityDateEditor.module.css";

const initialState: UpdateActivityDateState = {
  success: false,
  message: "",
};

type Props = {
  activityId: string;
  currentStartDate: string;
  currentStartTime: string;
  currentEndDate?: string;
  currentEndTime?: string;
};

export default function ActivityDateEditor({
  activityId,
  currentStartDate,
  currentStartTime,
  currentEndDate = "",
  currentEndTime = "",
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [toast, setToast] = useState("");
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [state, formAction, pending] = useActionState(
    updateActivityDate,
    initialState,
  );
  const scheduleRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setPortalTarget(document.getElementById("app-portal-root"));
  }, []);

  function closeModal() {
    if (pending || closing) {
      return;
    }

    setClosing(true);
    closeTimerRef.current = setTimeout(() => {
      setOpen(false);
      setClosing(false);
      setShowFeedback(false);
    }, 180);
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    scheduleRef.current?.querySelector<HTMLButtonElement>("button")?.focus();

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) {
        closeModal();
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open, pending]);

  useEffect(() => {
    if (!state.message) {
      return;
    }

    setShowFeedback(true);

    if (state.success) {
      setToast(state.message);
      router.refresh();

      if (!closing) {
        setClosing(true);
        closeTimerRef.current = setTimeout(() => {
          setOpen(false);
          setClosing(false);
          setShowFeedback(false);
        }, 180);
      }
    }
  }, [state, router]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = setTimeout(() => setToast(""), 3600);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(
    () => () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    },
    [],
  );

  return (
    <>
      <button
        type="button"
        className={styles.editButton}
        aria-label="تعديل موعد النشاط"
        title="تعديل موعد النشاط"
        onClick={() => {
          setShowFeedback(false);
          setClosing(false);
          setOpen(true);
        }}
        aria-haspopup="dialog"
      >
        <Pencil size={14} aria-hidden="true" />
      </button>

      {open && portalTarget && createPortal(
        <div
          className={`${styles.overlay} ${closing ? styles.overlayClosing : ""}`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <section
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="activity-date-dialog-title"
          >
            <div className={styles.dialogHead}>
              <div className={styles.dialogIcon} aria-hidden="true">
                <CalendarDays size={22} />
              </div>

              <div>
                <h2 id="activity-date-dialog-title">تعديل موعد النشاط</h2>
              </div>

              <button
                type="button"
                className={styles.closeButton}
                onClick={closeModal}
                disabled={pending}
                aria-label="إغلاق نافذة تعديل التاريخ"
              >
                <X size={19} />
              </button>
            </div>

            <p className={styles.description}>
              عدّل تاريخ أو وقت البداية، ويمكنك إضافة موعد نهاية اختياري أو إزالته بترك حقليه فارغين.
            </p>

            <form
              action={formAction}
              className={styles.form}
              onSubmit={() => setShowFeedback(true)}
            >
              <input type="hidden" name="activityId" value={activityId} />

              <div ref={scheduleRef}>
                <ActivitySchedulePicker
                  initialStartDate={currentStartDate}
                  initialStartTime={currentStartTime}
                  initialEndDate={currentEndDate}
                  initialEndTime={currentEndTime}
                  compact
                />
              </div>

              {showFeedback && state.message && !state.success && (
                <p className={styles.errorMessage} role="alert">
                  {state.message}
                </p>
              )}

              <div className={styles.actions}>
                <button
                  type="submit"
                  className={styles.saveButton}
                  disabled={pending}
                >
                  {pending ? "جارٍ الحفظ..." : "حفظ التعديل"}
                </button>

                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={closeModal}
                  disabled={pending}
                >
                  إلغاء
                </button>
              </div>
            </form>
          </section>
        </div>,
        portalTarget,
      )}

      {toast && (
        <div className={styles.toast} role="status" aria-live="polite">
          <CheckCircle2 size={19} aria-hidden="true" />
          {toast}
        </div>
      )}
    </>
  );
}
