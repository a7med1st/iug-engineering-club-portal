"use client";

import { useActionState } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";

import {
  escalateContactRequest,
  type ContactEscalationState,
} from "@/app/admin/contact/actions";

const initialState: ContactEscalationState = {
  success: false,
  message: "",
};

export default function ContactEscalationForm({
  id,
  kind,
  assignedName,
}: {
  id: string;
  kind:
    | "complaint"
    | "suggestion"
    | "collaboration";
  assignedName: string | null;
}) {
  const [state, formAction, pending] =
    useActionState(
      escalateContactRequest,
      initialState,
    );

  return (
    <form
      action={formAction}
      className="contact-escalation-form"
    >
      <input type="hidden" name="id" value={id} />
      <input
        type="hidden"
        name="kind"
        value={kind}
      />

      <div className="contact-escalation-heading">
        <ArrowUpRight aria-hidden="true" />
        <div>
          <strong>
            {assignedName
              ? "رفع للمسؤول الأعلى"
              : "توجيه للمسؤول المختص"}
          </strong>
          <small>
            {assignedName
              ? `المسؤول الحالي: ${assignedName}`
              : "هذا الطلب غير موجّه حاليًا."}
          </small>
        </div>
      </div>

      <label htmlFor={`escalation-note-${kind}-${id}`}>
        سبب الرفع أو ملاحظة للمسؤول الأعلى
        <span>اختياري</span>
      </label>
      <textarea
        id={`escalation-note-${kind}-${id}`}
        name="note"
        maxLength={500}
        rows={3}
        placeholder="مثال: تحتاج المشكلة إلى صلاحية أو قرار من الإدارة الأعلى..."
        disabled={pending}
      />

      {state.message && (
        <div
          className={`contact-escalation-feedback ${
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
        className="ghost-btn contact-escalation-submit"
        disabled={pending}
      >
        {pending ? (
          <LoaderCircle
            className="contact-escalation-spinner"
            aria-hidden="true"
          />
        ) : (
          <ArrowUpRight aria-hidden="true" />
        )}
        {pending
          ? "جاري التحويل..."
          : assignedName
            ? "رفع للمسؤول الأعلى"
            : "توجيه تلقائي"}
      </button>
    </form>
  );
}
