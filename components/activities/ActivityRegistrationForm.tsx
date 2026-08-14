"use client";

import type {
  ActivityFormQuestionType,
} from "@prisma/client";
import {
  useActionState,
  useTransition,
} from "react";

import {
  submitActivityRegistration,
  type RegistrationFormState,
} from "@/app/activities/[id]/register/actions";

type Question = {
  id: string;
  label: string;
  type: ActivityFormQuestionType;
  required: boolean;

  placeholder: string | null;
  helpText: string | null;

  options: string[];
};

type Props = {
  activityId: string;
  formId: string;
  questions: Question[];
};

const initialState: RegistrationFormState =
  {
    success: false,
    message: "",
  };

export default function ActivityRegistrationForm({
  activityId,
  formId,
  questions,
}: Props) {
  const [state, formAction] =
    useActionState(
      submitActivityRegistration,
      initialState,
    );

  const [pending, startTransition] =
    useTransition();

  function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (pending || state.success) {
      return;
    }

    const form =
      event.currentTarget;

    /*
     * Browser validation أولًا.
     */
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    /*
     * بهذه الطريقة الحقول لا تختفي إذا
     * رجع السيرفر بخطأ Validation.
     */
    const formData =
      new FormData(form);

    startTransition(() => {
      formAction(formData);
    });
  }

  return (
    <form
      className="activity-dynamic-form"
      onSubmit={handleSubmit}
    >
      <input
        type="hidden"
        name="activityId"
        value={activityId}
      />

      <input
        type="hidden"
        name="formId"
        value={formId}
      />


      {questions.map(
        (question) => (
          <QuestionField
            key={question.id}
            question={question}
            disabled={
              pending ||
              state.success
            }
          />
        ),
      )}


      {state.message && (
        <div
          className={
            state.success
              ? "activity-registration-message success"
              : "activity-registration-message error"
          }
          role="status"
        >
          {state.message}
        </div>
      )}


      <button
        type="submit"
        className="primary-btn activity-form-submit"
        disabled={
          pending ||
          state.success
        }
      >
        {state.success
          ? "تم التسجيل ✓"
          : pending
            ? "جاري إرسال التسجيل..."
            : "إرسال التسجيل"}
      </button>

    </form>
  );
}


function QuestionField({
  question,
  disabled,
}: {
  question: Question;
  disabled: boolean;
}) {
  const fieldName =
    `question_${question.id}`;

  return (
    <div className="activity-form-field">

      <label className="activity-form-label">

        {question.label}

        {question.required && (
          <span
            className="activity-required-mark"
            aria-hidden="true"
          >
            *
          </span>
        )}

      </label>


      {question.helpText && (
        <p className="activity-form-help">
          {question.helpText}
        </p>
      )}


      {question.type ===
        "SHORT_TEXT" && (
        <input
          type="text"
          name={fieldName}
          required={
            question.required
          }
          disabled={disabled}
          placeholder={
            question.placeholder ||
            ""
          }
        />
      )}


      {question.type ===
        "LONG_TEXT" && (
        <textarea
          name={fieldName}
          required={
            question.required
          }
          disabled={disabled}
          placeholder={
            question.placeholder ||
            ""
          }
          rows={5}
        />
      )}


      {question.type ===
        "EMAIL" && (
        <input
          type="email"
          name={fieldName}
          required={
            question.required
          }
          disabled={disabled}
          placeholder={
            question.placeholder ||
            "example@email.com"
          }
        />
      )}


      {question.type ===
        "PHONE" && (
        <input
          type="tel"
          name={fieldName}
          required={
            question.required
          }
          disabled={disabled}
          placeholder={
            question.placeholder ||
            "رقم الهاتف"
          }
        />
      )}


      {question.type ===
        "NUMBER" && (
        <input
          type="number"
          name={fieldName}
          required={
            question.required
          }
          disabled={disabled}
          placeholder={
            question.placeholder ||
            ""
          }
        />
      )}


      {question.type ===
        "SELECT" && (
        <select
          name={fieldName}
          required={
            question.required
          }
          disabled={disabled}
          defaultValue=""
        >
          <option
            value=""
            disabled
          >
            اختر من القائمة
          </option>

          {question.options.map(
            (
              option,
              index,
            ) => (
              <option
                key={`${question.id}-${index}`}
                value={option}
              >
                {option}
              </option>
            ),
          )}

        </select>
      )}


      {question.type ===
        "RADIO" && (
        <div className="activity-options-list">

          {question.options.map(
            (
              option,
              index,
            ) => (
              <label
                key={`${question.id}-${index}`}
                className="activity-option"
              >
                <input
                  type="radio"
                  name={fieldName}
                  value={option}
                  required={
                    question.required
                  }
                  disabled={
                    disabled
                  }
                />

                <span>
                  {option}
                </span>

              </label>
            ),
          )}

        </div>
      )}


      {question.type ===
        "CHECKBOX" && (
        <div className="activity-options-list">

          {question.options.map(
            (
              option,
              index,
            ) => (
              <label
                key={`${question.id}-${index}`}
                className="activity-option"
              >
                <input
                  type="checkbox"
                  name={fieldName}
                  value={option}
                  disabled={
                    disabled
                  }
                />

                <span>
                  {option}
                </span>

              </label>
            ),
          )}

        </div>
      )}

    </div>
  );
}