"use client";

import { useEffect, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
} from "lucide-react";

import { useCspNonce } from "@/components/security/CspNonce";

type QuestionType =
  | "SHORT_TEXT"
  | "LONG_TEXT"
  | "EMAIL"
  | "PHONE"
  | "NUMBER"
  | "SELECT"
  | "RADIO"
  | "CHECKBOX";

export type ActivityFormBuilderInitialQuestion = {
  id: string;
  label: string;
  type: QuestionType;
  required: boolean;
  placeholder: string | null;
  helpText: string | null;
  options: string[];
  answerCount?: number;
};

type BuilderQuestion = {
  id: string | null;
  localId: string;
  label: string;
  type: QuestionType;
  required: boolean;
  placeholder: string;
  helpText: string;
  options: string[];
  answerCount: number;
};

type ActivityFormBuilderProps = {
  initialTitle?: string;
  initialDescription?: string;
  initialIsOpen?: boolean;
  initialQuestions?: ActivityFormBuilderInitialQuestion[];
};

const QUESTION_TYPES: {
  value: QuestionType;
  label: string;
  hint: string;
}[] = [
  { value: "SHORT_TEXT", label: "نص قصير", hint: "إجابة قصيرة من سطر واحد" },
  { value: "LONG_TEXT", label: "نص طويل", hint: "إجابة طويلة أو وصف" },
  { value: "EMAIL", label: "بريد إلكتروني", hint: "حقل مخصص للبريد" },
  { value: "PHONE", label: "رقم هاتف", hint: "حقل مخصص لرقم الهاتف" },
  { value: "NUMBER", label: "رقم", hint: "إدخال أرقام فقط" },
  { value: "SELECT", label: "قائمة منسدلة", hint: "اختيار خيار واحد من قائمة" },
  { value: "RADIO", label: "اختيار واحد", hint: "Radio · خيار واحد ظاهر" },
  { value: "CHECKBOX", label: "اختيارات متعددة", hint: "Checkbox · أكثر من خيار" },
];

function createQuestion(): BuilderQuestion {
  return {
    id: null,
    localId: crypto.randomUUID(),
    label: "",
    type: "SHORT_TEXT",
    required: false,
    placeholder: "",
    helpText: "",
    options: [],
    answerCount: 0,
  };
}

function needsOptions(type: QuestionType) {
  return type === "SELECT" || type === "RADIO" || type === "CHECKBOX";
}

export default function ActivityFormBuilder({
  initialTitle = "نموذج التسجيل",
  initialDescription = "",
  initialIsOpen = true,
  initialQuestions = [],
}: ActivityFormBuilderProps) {
  const nonce = useCspNonce();

  const [questions, setQuestions] = useState<BuilderQuestion[]>(
    () =>
      initialQuestions.map((question, index) => ({
        id: question.id,
        localId: question.id || `initial-question-${index}`,
        label: question.label,
        type: question.type,
        required: question.required,
        placeholder: question.placeholder ?? "",
        helpText: question.helpText ?? "",
        options: [...question.options],
        answerCount: question.answerCount ?? 0,
      })),
  );

  const [openTypeMenuId, setOpenTypeMenuId] = useState<string | null>(null);

  useEffect(() => {
    const closeOnOutside = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest("[data-question-type-menu]")) {
        setOpenTypeMenuId(null);
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenTypeMenuId(null);
    };

    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  function addQuestion() {
    setQuestions((current) => [...current, createQuestion()]);
  }

  function removeQuestion(localId: string) {
    setQuestions((current) =>
      current.filter((question) => question.localId !== localId),
    );
    setOpenTypeMenuId((current) => (current === localId ? null : current));
  }

  function updateQuestion(
    localId: string,
    updates: Partial<BuilderQuestion>,
  ) {
    setQuestions((current) =>
      current.map((question) =>
        question.localId === localId
          ? {
              ...question,
              ...updates,
            }
          : question,
      ),
    );
  }

  function changeQuestionType(localId: string, type: QuestionType) {
    setQuestions((current) =>
      current.map((question) => {
        if (question.localId !== localId) return question;

        const requiresOptions = needsOptions(type);

        return {
          ...question,
          type,
          options: requiresOptions
            ? question.options.length > 0
              ? question.options
              : ["", ""]
            : [],
        };
      }),
    );
  }

  function moveQuestion(index: number, direction: "up" | "down") {
    setQuestions((current) => {
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= current.length) return current;

      const copy = [...current];
      [copy[index], copy[targetIndex]] = [copy[targetIndex], copy[index]];
      return copy;
    });
  }

  function addOption(questionId: string) {
    setQuestions((current) =>
      current.map((question) =>
        question.localId === questionId
          ? {
              ...question,
              options: [...question.options, ""],
            }
          : question,
      ),
    );
  }

  function updateOption(questionId: string, optionIndex: number, value: string) {
    setQuestions((current) =>
      current.map((question) => {
        if (question.localId !== questionId) return question;

        const options = [...question.options];
        options[optionIndex] = value;

        return {
          ...question,
          options,
        };
      }),
    );
  }

  function removeOption(questionId: string, optionIndex: number) {
    setQuestions((current) =>
      current.map((question) => {
        if (question.localId !== questionId) return question;

        return {
          ...question,
          options: question.options.filter((_, index) => index !== optionIndex),
        };
      }),
    );
  }

  const serializedQuestions = JSON.stringify(
    questions.map(
      (
        {
          localId: _localId,
          answerCount: _answerCount,
          ...question
        },
        index,
      ) => ({
        ...question,
        label: question.label.trim(),
        placeholder: question.placeholder.trim(),
        helpText: question.helpText.trim(),
        options: question.options.map((option) => option.trim()).filter(Boolean),
        sortOrder: index,
      }),
    ),
  );

  return (
    <section className="activity-form-builder">
      <input
        type="hidden"
        name="registrationQuestions"
        value={serializedQuestions}
      />

      <div className="activity-builder-heading">
        <div>
          <span className="activity-builder-eyebrow">نموذج التسجيل الداخلي</span>
          <h2>أسئلة التسجيل</h2>
          <p>
            أنشئ نموذج التسجيل الخاص بهذا النشاط وحدد نوع كل سؤال والخيارات
            المطلوبة.
          </p>
        </div>

        <button
          type="button"
          className="activity-builder-add"
          onClick={addQuestion}
        >
          <Plus size={18} />
          إضافة سؤال
        </button>
      </div>

      <div className="activity-builder-settings">
        <div className="field">
          <label htmlFor="registrationFormTitle">عنوان النموذج</label>
          <input
            id="registrationFormTitle"
            name="registrationFormTitle"
            type="text"
            defaultValue={initialTitle}
            placeholder="مثال: نموذج التسجيل في الدورة"
          />
        </div>

        <div className="field">
          <label htmlFor="registrationFormDescription">وصف النموذج</label>
          <textarea
            id="registrationFormDescription"
            name="registrationFormDescription"
            rows={3}
            defaultValue={initialDescription}
            placeholder="تعليمات أو ملاحظات تظهر للطالب قبل تعبئة النموذج"
          />
        </div>

        <label className="activity-builder-open-toggle">
          <input
            type="checkbox"
            name="registrationFormIsOpen"
            defaultChecked={initialIsOpen}
          />
          <span>فتح التسجيل مباشرة بعد نشر النشاط</span>
        </label>
      </div>

      {questions.length === 0 ? (
        <div className="activity-builder-empty">
          <div className="activity-builder-empty-icon">
            <Plus size={24} />
          </div>
          <h3>لم تتم إضافة أسئلة بعد</h3>
          <p>اضغط على "إضافة سؤال" لإنشاء أول سؤال في نموذج التسجيل.</p>
          <button
            type="button"
            className="activity-builder-empty-btn"
            onClick={addQuestion}
          >
            <Plus size={17} />
            إضافة أول سؤال
          </button>
        </div>
      ) : (
        <div className="activity-builder-questions">
          {questions.map((question, index) => {
            const selectedType =
              QUESTION_TYPES.find((item) => item.value === question.type) ??
              QUESTION_TYPES[0];
            const isTypeMenuOpen = openTypeMenuId === question.localId;

            return (
              <article
                className="activity-builder-question"
                key={question.localId}
              >
                <div className="activity-builder-question-top">
                  <div className="activity-builder-question-number" aria-label={`السؤال ${index + 1}`}>
                    <span className="activity-builder-question-number-label">السؤال</span>
                    <span className="activity-builder-question-number-index">{index + 1}</span>
                  </div>

                  <div className="activity-builder-question-actions">
                    <button
                      type="button"
                      aria-label="تحريك السؤال للأعلى"
                      title="تحريك للأعلى"
                      disabled={index === 0}
                      onClick={() => moveQuestion(index, "up")}
                    >
                      <ChevronUp size={18} />
                    </button>

                    <button
                      type="button"
                      aria-label="تحريك السؤال للأسفل"
                      title="تحريك للأسفل"
                      disabled={index === questions.length - 1}
                      onClick={() => moveQuestion(index, "down")}
                    >
                      <ChevronDown size={18} />
                    </button>

                    <button
                      type="button"
                      className="danger"
                      aria-label="حذف السؤال"
                      title={
                        question.answerCount > 0
                          ? "لا يمكن حذف سؤال لديه إجابات سابقة"
                          : "حذف السؤال"
                      }
                      disabled={question.answerCount > 0}
                      onClick={() => removeQuestion(question.localId)}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>

                <div className="activity-builder-grid">
                  <div className="field activity-builder-label-field">
                    <label>نص السؤال</label>
                    <input
                      type="text"
                      value={question.label}
                      placeholder="مثال: ما هو رقمك الجامعي؟"
                      onChange={(event) =>
                        updateQuestion(question.localId, {
                          label: event.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="field question-type-field">
                    <label>نوع السؤال</label>

                    <div
                      className={`question-type-select ${
                        isTypeMenuOpen ? "is-open" : ""
                      }`}
                      data-question-type-menu
                    >
                      <button
                        type="button"
                        className="question-type-trigger"
                        aria-haspopup="listbox"
                        aria-expanded={isTypeMenuOpen}
                        onClick={() =>
                          setOpenTypeMenuId((current) =>
                            current === question.localId
                              ? null
                              : question.localId,
                          )
                        }
                      >
                        <span className="question-type-trigger-copy">
                          <strong>{selectedType.label}</strong>
                          <small>{selectedType.hint}</small>
                        </span>

                        <span className="question-type-chevron" aria-hidden="true">
                          <ChevronDown size={20} />
                        </span>
                      </button>

                      {isTypeMenuOpen && (
                        <div
                          className="question-type-menu"
                          role="listbox"
                          aria-label="نوع السؤال"
                        >
                          <div className="question-type-menu-head">
                            اختر نوع السؤال
                          </div>

                          <div className="question-type-options">
                            {QUESTION_TYPES.map((item) => {
                              const active = item.value === question.type;

                              return (
                                <button
                                  type="button"
                                  role="option"
                                  aria-selected={active}
                                  key={item.value}
                                  className={`question-type-option ${
                                    active ? "is-active" : ""
                                  }`}
                                  onClick={() => {
                                    changeQuestionType(question.localId, item.value);
                                    setOpenTypeMenuId(null);
                                  }}
                                >
                                  <span className="question-type-option-mark">
                                    {active ? <Check size={15} /> : null}
                                  </span>

                                  <span className="question-type-option-copy">
                                    <strong>{item.label}</strong>
                                    <small>{item.hint}</small>
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="activity-builder-grid">
                  <div className="field">
                    <label>Placeholder</label>
                    <input
                      type="text"
                      value={question.placeholder}
                      placeholder="نص إرشادي اختياري داخل الحقل"
                      onChange={(event) =>
                        updateQuestion(question.localId, {
                          placeholder: event.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="field">
                    <label>ملاحظة توضيحية</label>
                    <input
                      type="text"
                      value={question.helpText}
                      placeholder="تعليمات اختيارية تظهر أسفل السؤال"
                      onChange={(event) =>
                        updateQuestion(question.localId, {
                          helpText: event.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <label className="activity-builder-required">
                  <input
                    type="checkbox"
                    checked={question.required}
                    onChange={(event) =>
                      updateQuestion(question.localId, {
                        required: event.target.checked,
                      })
                    }
                  />
                  <span>هذا السؤال إجباري</span>
                </label>

                {needsOptions(question.type) && (
                  <div className="activity-builder-options">
                    <div className="activity-builder-options-head">
                      <div>
                        <strong>خيارات السؤال</strong>
                        <span>أضف الخيارات التي يستطيع الطالب الاختيار منها</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => addOption(question.localId)}
                      >
                        <Plus size={15} />
                        إضافة خيار
                      </button>
                    </div>

                    <div className="activity-builder-options-list">
                      {question.options.map((option, optionIndex) => (
                        <div
                          className="activity-builder-option-row"
                          key={`${question.localId}-${optionIndex}`}
                        >
                          <span>{optionIndex + 1}</span>
                          <input
                            type="text"
                            value={option}
                            placeholder={`الخيار ${optionIndex + 1}`}
                            onChange={(event) =>
                              updateOption(
                                question.localId,
                                optionIndex,
                                event.target.value,
                              )
                            }
                          />
                          <button
                            type="button"
                            aria-label="حذف الخيار"
                            title="حذف الخيار"
                            disabled={question.options.length <= 1}
                            onClick={() =>
                              removeOption(question.localId, optionIndex)
                            }
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {questions.length > 0 && (
        <button
          type="button"
          className="activity-builder-add-bottom"
          onClick={addQuestion}
        >
          <Plus size={17} />
          إضافة سؤال آخر
        </button>
      )}

      <style nonce={nonce}>{`

        .activity-builder-question-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 16px;
        }

        .activity-builder-question-number {
          position: relative;
          isolation: isolate;
          flex: 0 0 auto;
          padding: 7px 10px 7px 14px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1px solid rgba(135, 189, 237, .38);
          border-radius: 16px;
          background:
            linear-gradient(135deg, rgba(255,255,255,.96) 0%, rgba(240,248,255,.96) 55%, rgba(230,246,255,.92) 100%);
          box-shadow:
            0 10px 26px rgba(22, 136, 255, .10),
            inset 0 1px 0 rgba(255,255,255,.95);
          overflow: hidden;
        }

        .activity-builder-question-number::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -1;
          background:
            radial-gradient(circle at 15% 20%, rgba(22,136,255,.12), transparent 35%),
            radial-gradient(circle at 85% 85%, rgba(53,212,255,.12), transparent 38%);
        }

        .activity-builder-question-number-label {
          color: #1c4f88;
          font-family: "Alexandria", sans-serif;
          font-size: .63rem;
          font-weight: 700;
          letter-spacing: .01em;
          white-space: nowrap;
        }

        .activity-builder-question-number-index {
          min-width: 32px;
          height: 32px;
          padding-inline: 8px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 11px;
          background: linear-gradient(135deg, #1688ff 0%, #28a7ff 58%, #35d4ff 100%);
          box-shadow:
            0 10px 18px rgba(22, 136, 255, .24),
            inset 0 1px 0 rgba(255,255,255,.3);
          color: #fff;
          font-family: "Alexandria", sans-serif;
          font-size: .74rem;
          font-weight: 800;
          line-height: 1;
        }

        .activity-builder-question-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .activity-builder-question-actions button {
          width: 40px;
          height: 40px;
          display: grid;
          place-items: center;
          border: 1px solid #d8e4f0;
          border-radius: 12px;
          background: rgba(255,255,255,.88);
          color: #75879b;
          box-shadow: 0 6px 16px rgba(9, 41, 73, .04);
          transition:
            transform .22s ease,
            border-color .22s ease,
            background .22s ease,
            color .22s ease,
            box-shadow .22s ease,
            opacity .22s ease;
        }

        .activity-builder-question-actions button:hover:not(:disabled) {
          transform: translateY(-2px);
          border-color: #9dc8ee;
          background: linear-gradient(180deg, #ffffff, #f2f8ff);
          color: #1688ff;
          box-shadow: 0 10px 22px rgba(22, 136, 255, .12);
        }

        .activity-builder-question-actions button:disabled {
          opacity: .48;
          cursor: not-allowed;
          box-shadow: none;
        }

        .activity-builder-question-actions button.danger {
          border-color: #f2d4d4;
          color: #ae3838;
          background: linear-gradient(180deg, #fffafa, #fff2f2);
        }

        .activity-builder-question-actions button.danger:hover {
          border-color: #e9aaaa;
          color: #981f1f;
          background: linear-gradient(180deg, #fff6f6, #ffe9e9);
          box-shadow: 0 10px 22px rgba(181, 50, 50, .12);
        }

        .question-type-field {
          position: relative;
          z-index: 20;
        }

        .question-type-select {
          position: relative;
          width: 100%;
        }

        .question-type-trigger {
          width: 100%;
          min-height: 66px;
          padding: 10px 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border: 1px solid #c9dced;
          border-radius: 15px;
          background:
            linear-gradient(180deg, rgba(255,255,255,.98), rgba(247,251,255,.96));
          color: #102139;
          cursor: pointer;
          text-align: right;
          box-shadow:
            0 6px 18px rgba(8, 46, 84, .045),
            inset 0 1px 0 rgba(255,255,255,.9);
          transition:
            transform .22s ease,
            border-color .22s ease,
            box-shadow .22s ease,
            background .22s ease;
        }

        .question-type-trigger:hover {
          transform: translateY(-1px);
          border-color: #86bff2;
          background:
            linear-gradient(135deg, #ffffff 0%, #f0f8ff 58%, #eefcff 100%);
          box-shadow:
            0 10px 24px rgba(22, 136, 255, .11),
            0 0 0 3px rgba(22, 136, 255, .045);
        }

        .question-type-select.is-open .question-type-trigger {
          border-color: #1688ff;
          box-shadow:
            0 0 0 3px rgba(22, 136, 255, .12),
            0 12px 28px rgba(10, 74, 132, .12);
        }

        .question-type-trigger-copy {
          min-width: 0;
          display: grid;
          gap: 2px;
        }

        .question-type-trigger-copy strong {
          color: #102139;
          font-family: "Alexandria", sans-serif;
          font-size: .78rem;
          line-height: 1.45;
        }

        .question-type-trigger-copy small {
          color: #7b8ca0;
          font-size: .64rem;
          line-height: 1.45;
        }

        .question-type-chevron {
          flex: 0 0 auto;
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          background: #edf6ff;
          color: #147bdc;
          transition:
            transform .22s ease,
            background .22s ease,
            color .22s ease;
        }

        .question-type-select.is-open .question-type-chevron {
          transform: rotate(180deg);
          background: linear-gradient(135deg, #1688ff, #35d4ff);
          color: #fff;
        }

        .question-type-menu {
          position: relative;
          z-index: 4;
          max-height: 360px;
          margin-top: 9px;
          overflow-y: auto;
          padding: 7px;
          border: 1px solid rgba(177, 205, 233, .9);
          border-radius: 18px;
          background:
            radial-gradient(circle at 90% 0%, rgba(22,136,255,.11), transparent 34%),
            linear-gradient(180deg, rgba(255,255,255,.99), rgba(247,251,255,.98));
          box-shadow:
            0 24px 55px rgba(5, 31, 61, .20),
            0 6px 18px rgba(22, 136, 255, .08);
          backdrop-filter: blur(18px);
          animation: questionTypeMenuIn .18s cubic-bezier(.22, 1, .36, 1) both;
        }

        .question-type-menu-head {
          padding: 8px 10px 9px;
          color: #7a8ca1;
          font-family: "Alexandria", sans-serif;
          font-size: .61rem;
          font-weight: 700;
        }

        .question-type-options {
          display: grid;
          gap: 4px;
        }

        .question-type-option {
          width: 100%;
          min-height: 52px;
          padding: 8px 10px;
          display: flex;
          align-items: center;
          gap: 10px;
          border: 1px solid transparent;
          border-radius: 12px;
          background: transparent;
          color: #203955;
          cursor: pointer;
          text-align: right;
          transition:
            transform .18s ease,
            background .18s ease,
            border-color .18s ease,
            box-shadow .18s ease;
        }

        .question-type-option:hover {
          transform: translateX(-2px);
          border-color: rgba(22, 136, 255, .13);
          background: linear-gradient(90deg, #eef8ff, #f7fcff);
          box-shadow: 0 7px 18px rgba(22, 136, 255, .07);
        }

        .question-type-option.is-active {
          border-color: rgba(22, 136, 255, .2);
          background:
            linear-gradient(135deg, rgba(22,136,255,.12), rgba(53,212,255,.09));
        }

        .question-type-option-mark {
          flex: 0 0 auto;
          width: 27px;
          height: 27px;
          display: grid;
          place-items: center;
          border: 1px solid #d6e4f2;
          border-radius: 9px;
          background: rgba(255,255,255,.82);
          color: #1688ff;
        }

        .question-type-option.is-active .question-type-option-mark {
          border-color: transparent;
          background: linear-gradient(135deg, #1688ff, #35d4ff);
          color: #fff;
          box-shadow: 0 6px 14px rgba(22,136,255,.20);
        }

        .question-type-option-copy {
          min-width: 0;
          display: grid;
          gap: 1px;
        }

        .question-type-option-copy strong {
          font-family: "Alexandria", sans-serif;
          font-size: .7rem;
          line-height: 1.5;
        }

        .question-type-option-copy small {
          color: #7a8ca1;
          font-size: .59rem;
          line-height: 1.45;
        }

        @keyframes questionTypeMenuIn {
          from {
            opacity: 0;
            transform: translateY(-7px) scale(.985);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        /* =========================================================
           REGISTRATION OPEN TOGGLE
           Keep checkbox + text on one compact row on every page.
        ========================================================= */

        .activity-builder-open-toggle {
          grid-column: 1 / -1;
          display: inline-flex !important;
          flex-direction: row !important;
          align-items: center !important;
          justify-content: flex-start !important;
          gap: 10px !important;

          width: fit-content !important;
          max-width: 100%;
          min-height: 44px;

          margin: 4px 0 0 !important;
          padding: 10px 14px !important;

          border: 1px solid rgba(190, 207, 226, .82);
          border-radius: 12px;

          background: rgba(255, 255, 255, .78);
          color: #19314d;

          direction: rtl;
          cursor: pointer;

          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, .88);

          transition:
            border-color .2s ease,
            background .2s ease,
            box-shadow .2s ease;
        }

        .activity-builder-open-toggle:hover {
          border-color: rgba(22, 136, 255, .34);
          background: #f1f8ff;
          box-shadow:
            0 8px 20px rgba(22, 136, 255, .08);
        }

        .activity-builder-open-toggle > input[type="checkbox"] {
          flex: 0 0 auto !important;
          width: 18px !important;
          height: 18px !important;
          min-width: 18px !important;

          margin: 0 !important;
          padding: 0 !important;

          accent-color: #1688ff;
          cursor: pointer;
        }

        .activity-builder-open-toggle > span {
          display: inline !important;
          width: auto !important;
          margin: 0 !important;
          padding: 0 !important;

          color: inherit;
          font-size: .78rem;
          font-weight: 700;
          line-height: 1.5;

          white-space: nowrap;
        }

        html[data-theme="dark"] .activity-builder-open-toggle {
          border-color: rgba(91, 169, 224, .36) !important;
          background: #0a2941 !important;
          color: #e7f2fb !important;

          box-shadow:
            inset 0 1px 0 rgba(157, 211, 248, .07) !important;
        }

        html[data-theme="dark"] .activity-builder-open-toggle:hover {
          border-color: rgba(103, 199, 255, .60) !important;
          background: #103550 !important;

          box-shadow:
            0 8px 20px rgba(0, 7, 18, .24) !important;
        }

        html[data-theme="dark"] .activity-builder-open-toggle > input[type="checkbox"] {
          accent-color: #1688ff !important;
          opacity: 1 !important;
          filter: none !important;
        }

        html[data-theme="dark"] .activity-builder-open-toggle > span {
          color: #e7f2fb !important;
          opacity: 1 !important;
          text-shadow: none !important;
        }

        @media (max-width: 560px) {
          .activity-builder-open-toggle {
            width: 100% !important;
            justify-content: flex-start !important;
          }

          .activity-builder-open-toggle > span {
            white-space: normal;
          }
        }

        /* =========================================================
           DARK MODE — ACTIVITY QUESTION BUILDER
        ========================================================= */

        html[data-theme="dark"] .activity-builder-question {
          border-color: rgba(91, 169, 224, .34) !important;
          background:
            radial-gradient(circle at 92% 4%, rgba(22, 136, 255, .10), transparent 30%),
            linear-gradient(180deg, #0d2a42 0%, #0a2338 100%) !important;
          box-shadow:
            inset 0 1px 0 rgba(157, 211, 248, .07),
            0 16px 34px rgba(0, 7, 18, .24) !important;
          color: #e7f2fb !important;
        }

        html[data-theme="dark"] .activity-builder-question .field > label,
        html[data-theme="dark"] .activity-builder-options-head strong,
        html[data-theme="dark"] .activity-builder-required > span {
          color: #e8f3fc !important;
        }

        html[data-theme="dark"] .activity-builder-question input[type="text"],
        html[data-theme="dark"] .activity-builder-question input[type="email"],
        html[data-theme="dark"] .activity-builder-question input[type="tel"],
        html[data-theme="dark"] .activity-builder-question input[type="number"],
        html[data-theme="dark"] .activity-builder-question textarea,
        html[data-theme="dark"] .activity-builder-question select {
          border-color: rgba(91, 169, 224, .34) !important;
          background: #08253b !important;
          color: #edf7ff !important;
          box-shadow:
            inset 0 1px 0 rgba(157, 211, 248, .05) !important;
        }

        html[data-theme="dark"] .activity-builder-question input::placeholder,
        html[data-theme="dark"] .activity-builder-question textarea::placeholder {
          color: #8fa9bf !important;
          opacity: 1 !important;
        }

        html[data-theme="dark"] .activity-builder-question input:focus,
        html[data-theme="dark"] .activity-builder-question textarea:focus,
        html[data-theme="dark"] .activity-builder-question select:focus {
          border-color: #3eaef5 !important;
          box-shadow:
            0 0 0 3px rgba(62, 174, 245, .14) !important;
          outline: none !important;
        }

        html[data-theme="dark"] .activity-builder-question-number {
          border-color: rgba(91, 169, 224, .38) !important;
          background:
            linear-gradient(135deg, #0b2941 0%, #0f3552 100%) !important;
          box-shadow:
            0 10px 26px rgba(0, 7, 18, .24),
            inset 0 1px 0 rgba(157, 211, 248, .08) !important;
        }

        html[data-theme="dark"] .activity-builder-question-number-label {
          color: #b9d9ef !important;
        }

        html[data-theme="dark"] .activity-builder-question-actions button {
          border-color: rgba(91, 169, 224, .35) !important;
          background: #0a2941 !important;
          color: #b8d5e9 !important;
          box-shadow:
            0 6px 16px rgba(0, 7, 18, .20) !important;
        }

        html[data-theme="dark"] .activity-builder-question-actions button:hover:not(:disabled) {
          border-color: rgba(103, 199, 255, .62) !important;
          background: #103550 !important;
          color: #67c7ff !important;
          box-shadow:
            0 10px 22px rgba(0, 7, 18, .26) !important;
        }

        html[data-theme="dark"] .activity-builder-question-actions button.danger {
          border-color: rgba(255, 112, 126, .34) !important;
          background: rgba(114, 31, 43, .28) !important;
          color: #ff98a2 !important;
        }

        html[data-theme="dark"] .activity-builder-question-actions button.danger:hover {
          border-color: rgba(255, 132, 145, .56) !important;
          background: rgba(135, 35, 49, .40) !important;
          color: #ffb0b7 !important;
        }

        html[data-theme="dark"] .question-type-trigger {
          border-color: rgba(91, 169, 224, .38) !important;
          background:
            linear-gradient(180deg, #0b2a42 0%, #08243a 100%) !important;
          color: #edf7ff !important;
          box-shadow:
            0 7px 18px rgba(0, 7, 18, .18),
            inset 0 1px 0 rgba(157, 211, 248, .06) !important;
        }

        html[data-theme="dark"] .question-type-trigger:hover {
          border-color: rgba(103, 199, 255, .60) !important;
          background:
            linear-gradient(135deg, #0f3552 0%, #0b2d47 100%) !important;
          box-shadow:
            0 10px 24px rgba(0, 7, 18, .24),
            0 0 0 3px rgba(62, 174, 245, .08) !important;
        }

        html[data-theme="dark"] .question-type-trigger-copy strong {
          color: #edf7ff !important;
        }

        html[data-theme="dark"] .question-type-trigger-copy small {
          color: #a8c0d2 !important;
        }

        html[data-theme="dark"] .question-type-chevron {
          background: #103754 !important;
          color: #67c7ff !important;
        }

        html[data-theme="dark"] .question-type-menu {
          border-color: rgba(91, 169, 224, .42) !important;
          background:
            radial-gradient(circle at 90% 0%, rgba(22, 136, 255, .12), transparent 34%),
            linear-gradient(180deg, #0b2941 0%, #071f33 100%) !important;
          box-shadow:
            0 24px 55px rgba(0, 7, 18, .48),
            0 6px 18px rgba(22, 136, 255, .10) !important;
        }

        html[data-theme="dark"] .question-type-menu-head,
        html[data-theme="dark"] .question-type-option-copy small,
        html[data-theme="dark"] .activity-builder-options-head span {
          color: #9fb9ce !important;
        }

        html[data-theme="dark"] .question-type-option {
          color: #dcecf8 !important;
        }

        html[data-theme="dark"] .question-type-option:hover {
          border-color: rgba(103, 199, 255, .22) !important;
          background: #10334d !important;
          box-shadow:
            0 7px 18px rgba(0, 7, 18, .22) !important;
        }

        html[data-theme="dark"] .question-type-option.is-active {
          border-color: rgba(103, 199, 255, .34) !important;
          background:
            linear-gradient(135deg, rgba(22, 136, 255, .22), rgba(53, 212, 255, .10)) !important;
        }

        html[data-theme="dark"] .question-type-option-mark {
          border-color: rgba(91, 169, 224, .38) !important;
          background: #0a2941 !important;
          color: #67c7ff !important;
        }

        html[data-theme="dark"] .activity-builder-required {
          display: inline-flex !important;
          flex-direction: row !important;
          align-items: center !important;
          justify-content: flex-start !important;
          gap: 9px !important;
          width: fit-content !important;
          max-width: 100%;
          margin-top: 14px !important;
          padding: 10px 12px !important;
          border: 1px solid rgba(91, 169, 224, .34) !important;
          border-radius: 12px !important;
          background: #0a2941 !important;
          cursor: pointer;
        }

        html[data-theme="dark"] .activity-builder-required > input[type="checkbox"] {
          flex: 0 0 auto;
          width: 18px !important;
          height: 18px !important;
          margin: 0 !important;
          accent-color: #1688ff;
          opacity: 1 !important;
        }

        html[data-theme="dark"] .activity-builder-required > span {
          display: inline !important;
          margin: 0 !important;
          line-height: 1.5;
          font-weight: 700;
        }

        html[data-theme="dark"] .activity-builder-options {
          border-color: rgba(91, 169, 224, .30) !important;
          background: rgba(7, 31, 51, .58) !important;
        }

        html[data-theme="dark"] .activity-builder-option-row {
          border-color: rgba(91, 169, 224, .26) !important;
          background: rgba(10, 41, 65, .66) !important;
        }


        @media (max-width: 560px) {
          .question-type-menu {
            max-height: 330px;
          }

          .question-type-trigger {
            min-height: 62px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .question-type-menu,
          .question-type-trigger,
          .question-type-option,
          .question-type-chevron {
            animation: none;
            transition: none;
          }
        }
      `}</style>
    </section>
  );
}
