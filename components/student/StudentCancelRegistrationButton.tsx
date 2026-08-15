"use client";

import {
  useActionState,
  useEffect,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import {
  AlertTriangle,
  X,
} from "lucide-react";

import {
  cancelActivityRegistration,
  type CancelRegistrationState,
} from "@/app/student/actions";

import styles from "@/app/student/student.module.css";

type Props = {
  submissionId: string;
  activityTitle: string;
};

const initialState: CancelRegistrationState = {
  success: false,
  message: "",
};

export default function StudentCancelRegistrationButton({
  submissionId,
  activityTitle,
}: Props) {
  const router = useRouter();

  const [
    confirming,
    setConfirming,
  ] = useState(false);

  const [
    state,
    formAction,
    pending,
  ] = useActionState(
    cancelActivityRegistration,
    initialState,
  );

  useEffect(() => {
    if (state.success) {
      setConfirming(false);
      router.refresh();
    }
  }, [state.success, router]);

  return (
    <>
      <button
        type="button"
        className={
          styles.cancelRegistrationButton
        }
        onClick={() =>
          setConfirming(true)
        }
      >
        إلغاء التسجيل
      </button>

      {confirming && (
        <div
          className={
            styles.cancelRegistrationLayer
          }
        >
          <section
            className={
              styles.cancelRegistrationCard
            }
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-registration-title"
          >
            <div
              className={
                styles.cancelRegistrationHeader
              }
            >
              <span
                className={
                  styles.cancelRegistrationIcon
                }
              >
                <AlertTriangle
                  size={22}
                />
              </span>

              <button
                type="button"
                className={
                  styles.cancelRegistrationClose
                }
                disabled={pending}
                onClick={() =>
                  setConfirming(false)
                }
                aria-label="إغلاق"
              >
                <X size={19} />
              </button>
            </div>

            <div
              className={
                styles.cancelRegistrationContent
              }
            >
              <h3
                id="cancel-registration-title"
              >
                إلغاء التسجيل؟
              </h3>

              <p>
                أنت على وشك إلغاء تسجيلك
                في:
              </p>

              <strong>
                {activityTitle}
              </strong>

              <small>
                بعد الإلغاء سيتم حذف
                تسجيلك وإجابات نموذج
                التسجيل، وسيصبح المقعد
                متاحًا لطالب آخر.
              </small>
            </div>

            {state.message &&
              !state.success && (
                <div
                  className={
                    styles.cancelRegistrationError
                  }
                >
                  {state.message}
                </div>
              )}

            <form
              action={formAction}
              className={
                styles.cancelRegistrationActions
              }
            >
              <input
                type="hidden"
                name="submissionId"
                value={submissionId}
              />

              <button
                type="button"
                className={
                  styles.keepRegistrationButton
                }
                disabled={pending}
                onClick={() =>
                  setConfirming(false)
                }
              >
                الاحتفاظ بالتسجيل
              </button>

              <button
                type="submit"
                className={
                  styles.confirmCancelButton
                }
                disabled={pending}
              >
                {pending
                  ? "جارٍ الإلغاء..."
                  : "نعم، إلغاء التسجيل"}
              </button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}