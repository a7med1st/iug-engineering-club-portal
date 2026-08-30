"use client";

import {
  useActionState,
  useEffect,
  useRef,
} from "react";
import {
  CheckCircle2,
  LoaderCircle,
  MessageSquareReply,
  Send,
  TriangleAlert,
} from "lucide-react";

import {
  sendComplaintReply,
  type ComplaintReplyState,
} from "@/app/admin/contact/actions";

const initialState: ComplaintReplyState = {
  success: false,
  message: "",
};

export default function ComplaintReplyForm({
  complaintId,
}: {
  complaintId: string;
}) {
  const formRef =
    useRef<HTMLFormElement>(null);
  const [state, formAction, pending] =
    useActionState(
      sendComplaintReply,
      initialState,
    );

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="complaint-reply-form"
    >
      <input
        type="hidden"
        name="complaintId"
        value={complaintId}
      />

      <div className="complaint-reply-heading">
        <MessageSquareReply
          size={20}
          aria-hidden="true"
        />
        <div>
          <strong>إرسال رد داخل الموقع</strong>
          <small>
            سيظهر الرد لصاحب الشكوى ويصله إشعار فورًا.
          </small>
        </div>
      </div>

      <label htmlFor={`reply-${complaintId}`}>
        نص الرد
      </label>
      <textarea
        id={`reply-${complaintId}`}
        name="message"
        required
        minLength={2}
        maxLength={2000}
        rows={4}
        placeholder="اكتب الرد الذي تريد إرساله لصاحب الشكوى..."
        disabled={pending}
      />

      {state.message && (
        <div
          className={`complaint-reply-feedback ${
            state.success
              ? "is-success"
              : "is-error"
          }`}
          role={state.success ? "status" : "alert"}
        >
          {state.success ? (
            <CheckCircle2 aria-hidden="true" />
          ) : (
            <TriangleAlert aria-hidden="true" />
          )}
          <span>{state.message}</span>
        </div>
      )}

      <button
        type="submit"
        className="primary-btn small complaint-reply-submit"
        disabled={pending}
      >
        {pending ? (
          <LoaderCircle
            className="complaint-reply-spinner"
            aria-hidden="true"
          />
        ) : (
          <Send size={17} aria-hidden="true" />
        )}
        {pending ? "جاري الإرسال..." : "إرسال الرد"}
      </button>
    </form>
  );
}
