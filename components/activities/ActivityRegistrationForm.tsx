"use client";

import type { ActivityFormQuestionType } from "@prisma/client";
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";

import {
  submitActivityRegistration,
  type RegistrationFormState,
  type RegistrationFormValues,
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

const initialState: RegistrationFormState = {
  success: false,
  message: "",
  values: {},
};

function emptyValues(questions: Question[]): RegistrationFormValues {
  return Object.fromEntries(questions.map((question) => [question.id, ""]));
}

export default function ActivityRegistrationForm({
  activityId,
  formId,
  questions,
}: Props) {
  const [state, formAction] = useActionState(
    submitActivityRegistration,
    initialState,
  );
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<RegistrationFormValues>(() =>
    emptyValues(questions),
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      setValues(emptyValues(questions));
      formRef.current?.reset();
      return;
    }

    if (Object.keys(state.values).length > 0) {
      setValues((current) => ({
        ...current,
        ...state.values,
      }));
    }
  }, [questions, state.success, state.values]);

  function updateAnswer(questionId: string, value: string) {
    setValues((current) => ({
      ...current,
      [questionId]: value,
    }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (pending || state.success) {
      return;
    }

    const form = event.currentTarget;

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const formData = new FormData(form);

    startTransition(() => {
      formAction(formData);
    });
  }

  return (
    <form
      ref={formRef}
      className="activity-dynamic-form"
      onSubmit={handleSubmit}
    >
      <input type="hidden" name="activityId" value={activityId} />
      <input type="hidden" name="formId" value={formId} />

      {questions.map((question) => (
        <QuestionField
          key={question.id}
          question={question}
          value={values[question.id] ?? ""}
          error={state.fieldErrors?.[question.id]}
          disabled={pending || state.success}
          onChange={(value) => updateAnswer(question.id, value)}
        />
      ))}

      {state.message && (
        <div
          className={
            state.success
              ? "activity-registration-message success"
              : "activity-registration-message error"
          }
          role={state.success ? "status" : "alert"}
          aria-live="polite"
        >
          {state.message}
        </div>
      )}

      <button
        type="submit"
        className="primary-btn activity-form-submit"
        disabled={pending || state.success}
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
  value,
  error,
  disabled,
  onChange,
}: {
  question: Question;
  value: string;
  error?: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const fieldName = `question_${question.id}`;
  const labelId = `${fieldName}_label`;
  const helpId = question.helpText ? `${fieldName}_help` : undefined;
  const errorId = error ? `${fieldName}_error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(" ") || undefined;
  const isOptionGroup = question.type === "RADIO" || question.type === "CHECKBOX";

  return (
    <div className="activity-form-field">
      {isOptionGroup ? (
        <div id={labelId} className="activity-form-label">
          {question.label}
          {question.required && (
            <span className="activity-required-mark" aria-hidden="true">
              *
            </span>
          )}
        </div>
      ) : (
        <label id={labelId} className="activity-form-label" htmlFor={fieldName}>
          {question.label}
          {question.required && (
            <span className="activity-required-mark" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      {question.helpText && (
        <p id={helpId} className="activity-form-help">
          {question.helpText}
        </p>
      )}

      {question.type === "SHORT_TEXT" && (
        <input
          id={fieldName}
          type="text"
          name={fieldName}
          value={value}
          required={question.required}
          disabled={disabled}
          placeholder={question.placeholder || ""}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
        />
      )}

      {question.type === "LONG_TEXT" && (
        <textarea
          id={fieldName}
          name={fieldName}
          value={value}
          required={question.required}
          disabled={disabled}
          placeholder={question.placeholder || ""}
          rows={5}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
        />
      )}

      {question.type === "EMAIL" && (
        <input
          id={fieldName}
          type="email"
          name={fieldName}
          value={value}
          required={question.required}
          disabled={disabled}
          placeholder={question.placeholder || "example@email.com"}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
        />
      )}

      {question.type === "PHONE" && (
        <input
          id={fieldName}
          type="tel"
          name={fieldName}
          value={value}
          required={question.required}
          disabled={disabled}
          placeholder={question.placeholder || "رقم الهاتف"}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
        />
      )}

      {question.type === "NUMBER" && (
        <input
          id={fieldName}
          type="number"
          name={fieldName}
          value={value}
          required={question.required}
          disabled={disabled}
          placeholder={question.placeholder || ""}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
        />
      )}

      {question.type === "SELECT" && (
        <select
          id={fieldName}
          name={fieldName}
          value={value}
          required={question.required}
          disabled={disabled}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="" disabled>
            اختر من القائمة
          </option>
          {question.options.map((option, index) => (
            <option key={`${question.id}-${index}`} value={option}>
              {option}
            </option>
          ))}
        </select>
      )}

      {isOptionGroup && (
        <div
          className="activity-options-list"
          role="radiogroup"
          aria-labelledby={labelId}
          aria-describedby={describedBy}
          aria-invalid={Boolean(error) || undefined}
        >
          {question.options.map((option, index) => (
            <label
              key={`${question.id}-${index}`}
              className="activity-option"
            >
              <input
                type="radio"
                name={fieldName}
                value={option}
                checked={value === option}
                required={question.required}
                disabled={disabled}
                onChange={() => onChange(option)}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      )}

      {error && (
        <p id={errorId} className="activity-form-field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
