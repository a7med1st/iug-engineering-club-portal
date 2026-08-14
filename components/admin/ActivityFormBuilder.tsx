"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
} from "lucide-react";

type QuestionType =
  | "SHORT_TEXT"
  | "LONG_TEXT"
  | "EMAIL"
  | "PHONE"
  | "NUMBER"
  | "SELECT"
  | "RADIO"
  | "CHECKBOX";

type BuilderQuestion = {
  localId: string;
  label: string;
  type: QuestionType;
  required: boolean;
  placeholder: string;
  helpText: string;
  options: string[];
};

const QUESTION_TYPES: {
  value: QuestionType;
  label: string;
}[] = [
  {
    value: "SHORT_TEXT",
    label: "نص قصير",
  },
  {
    value: "LONG_TEXT",
    label: "نص طويل",
  },
  {
    value: "EMAIL",
    label: "بريد إلكتروني",
  },
  {
    value: "PHONE",
    label: "رقم هاتف",
  },
  {
    value: "NUMBER",
    label: "رقم",
  },
  {
    value: "SELECT",
    label: "قائمة منسدلة",
  },
  {
    value: "RADIO",
    label: "اختيار واحد - Radio",
  },
  {
    value: "CHECKBOX",
    label: "اختيارات متعددة - Checkbox",
  },
];

function createQuestion(): BuilderQuestion {
  return {
    localId: crypto.randomUUID(),
    label: "",
    type: "SHORT_TEXT",
    required: false,
    placeholder: "",
    helpText: "",
    options: [],
  };
}

function needsOptions(type: QuestionType) {
  return (
    type === "SELECT" ||
    type === "RADIO" ||
    type === "CHECKBOX"
  );
}

export default function ActivityFormBuilder() {
  const [questions, setQuestions] = useState<
    BuilderQuestion[]
  >([]);

  function addQuestion() {
    setQuestions((current) => [
      ...current,
      createQuestion(),
    ]);
  }

  function removeQuestion(localId: string) {
    setQuestions((current) =>
      current.filter(
        (question) =>
          question.localId !== localId
      )
    );
  }

  function updateQuestion(
    localId: string,
    updates: Partial<BuilderQuestion>
  ) {
    setQuestions((current) =>
      current.map((question) =>
        question.localId === localId
          ? {
              ...question,
              ...updates,
            }
          : question
      )
    );
  }

  function changeQuestionType(
    localId: string,
    type: QuestionType
  ) {
    setQuestions((current) =>
      current.map((question) => {
        if (
          question.localId !== localId
        ) {
          return question;
        }

        const requiresOptions =
          needsOptions(type);

        return {
          ...question,
          type,

          options: requiresOptions
            ? question.options.length > 0
              ? question.options
              : ["", ""]
            : [],
        };
      })
    );
  }

  function moveQuestion(
    index: number,
    direction: "up" | "down"
  ) {
    setQuestions((current) => {
      const targetIndex =
        direction === "up"
          ? index - 1
          : index + 1;

      if (
        targetIndex < 0 ||
        targetIndex >= current.length
      ) {
        return current;
      }

      const copy = [...current];

      [copy[index], copy[targetIndex]] = [
        copy[targetIndex],
        copy[index],
      ];

      return copy;
    });
  }

  function addOption(
    questionId: string
  ) {
    setQuestions((current) =>
      current.map((question) =>
        question.localId === questionId
          ? {
              ...question,
              options: [
                ...question.options,
                "",
              ],
            }
          : question
      )
    );
  }

  function updateOption(
    questionId: string,
    optionIndex: number,
    value: string
  ) {
    setQuestions((current) =>
      current.map((question) => {
        if (
          question.localId !== questionId
        ) {
          return question;
        }

        const options = [
          ...question.options,
        ];

        options[optionIndex] = value;

        return {
          ...question,
          options,
        };
      })
    );
  }

  function removeOption(
    questionId: string,
    optionIndex: number
  ) {
    setQuestions((current) =>
      current.map((question) => {
        if (
          question.localId !== questionId
        ) {
          return question;
        }

        return {
          ...question,
          options:
            question.options.filter(
              (_, index) =>
                index !== optionIndex
            ),
        };
      })
    );
  }

  const serializedQuestions =
    JSON.stringify(
      questions.map(
        (
          {
            localId: _localId,
            ...question
          },
          index
        ) => ({
          ...question,

          label:
            question.label.trim(),

          placeholder:
            question.placeholder.trim(),

          helpText:
            question.helpText.trim(),

          options:
            question.options
              .map((option) =>
                option.trim()
              )
              .filter(Boolean),

          sortOrder: index,
        })
      )
    );

  return (
    <section className="activity-form-builder">

      {/* هذا هو الذي سيصل للـ Server Action */}
      <input
        type="hidden"
        name="registrationQuestions"
        value={serializedQuestions}
      />

      <div className="activity-builder-heading">

        <div>
          <span className="activity-builder-eyebrow">
            نموذج التسجيل الداخلي
          </span>

          <h2>
            أسئلة التسجيل
          </h2>

          <p>
            أنشئ نموذج التسجيل الخاص
            بهذا النشاط وحدد نوع كل
            سؤال والخيارات المطلوبة.
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
          <label htmlFor="registrationFormTitle">
            عنوان النموذج
          </label>

          <input
            id="registrationFormTitle"
            name="registrationFormTitle"
            type="text"
            defaultValue="نموذج التسجيل"
            placeholder="مثال: نموذج التسجيل في الدورة"
          />
        </div>


        <div className="field">
          <label htmlFor="registrationFormDescription">
            وصف النموذج
          </label>

          <textarea
            id="registrationFormDescription"
            name="registrationFormDescription"
            rows={3}
            placeholder="تعليمات أو ملاحظات تظهر للطالب قبل تعبئة النموذج"
          />
        </div>


        <label className="activity-builder-open-toggle">
          <input
            type="checkbox"
            name="registrationFormIsOpen"
            defaultChecked
          />

          <span>
            فتح التسجيل مباشرة بعد نشر النشاط
          </span>
        </label>

      </div>


      {questions.length === 0 ? (
        <div className="activity-builder-empty">

          <div className="activity-builder-empty-icon">
            <Plus size={24} />
          </div>

          <h3>
            لم تتم إضافة أسئلة بعد
          </h3>

          <p>
            اضغط على "إضافة سؤال"
            لإنشاء أول سؤال في نموذج
            التسجيل.
          </p>

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

          {questions.map(
            (question, index) => (
              <article
                className="activity-builder-question"
                key={question.localId}
              >

                <div className="activity-builder-question-top">

                  <div className="activity-builder-question-number">
                    السؤال {index + 1}
                  </div>


                  <div className="activity-builder-question-actions">

                    <button
                      type="button"
                      aria-label="تحريك السؤال للأعلى"
                      title="تحريك للأعلى"
                      disabled={index === 0}
                      onClick={() =>
                        moveQuestion(
                          index,
                          "up"
                        )
                      }
                    >
                      <ChevronUp
                        size={18}
                      />
                    </button>


                    <button
                      type="button"
                      aria-label="تحريك السؤال للأسفل"
                      title="تحريك للأسفل"
                      disabled={
                        index ===
                        questions.length -
                          1
                      }
                      onClick={() =>
                        moveQuestion(
                          index,
                          "down"
                        )
                      }
                    >
                      <ChevronDown
                        size={18}
                      />
                    </button>


                    <button
                      type="button"
                      className="danger"
                      aria-label="حذف السؤال"
                      title="حذف السؤال"
                      onClick={() =>
                        removeQuestion(
                          question.localId
                        )
                      }
                    >
                      <Trash2
                        size={17}
                      />
                    </button>

                  </div>

                </div>


                <div className="activity-builder-grid">

                  <div className="field activity-builder-label-field">

                    <label>
                      نص السؤال
                    </label>

                    <input
                      type="text"
                      value={
                        question.label
                      }
                      placeholder="مثال: ما هو رقمك الجامعي؟"
                      onChange={(
                        event
                      ) =>
                        updateQuestion(
                          question.localId,
                          {
                            label:
                              event
                                .target
                                .value,
                          }
                        )
                      }
                    />

                  </div>


                  <div className="field">

                    <label>
                      نوع السؤال
                    </label>

                    <select
                      value={
                        question.type
                      }
                      onChange={(
                        event
                      ) =>
                        changeQuestionType(
                          question.localId,
                          event.target
                            .value as QuestionType
                        )
                      }
                    >

                      {QUESTION_TYPES.map(
                        (item) => (
                          <option
                            key={
                              item.value
                            }
                            value={
                              item.value
                            }
                          >
                            {
                              item.label
                            }
                          </option>
                        )
                      )}

                    </select>

                  </div>

                </div>


                <div className="activity-builder-grid">

                  <div className="field">

                    <label>
                      Placeholder
                    </label>

                    <input
                      type="text"
                      value={
                        question.placeholder
                      }
                      placeholder="نص إرشادي اختياري داخل الحقل"
                      onChange={(
                        event
                      ) =>
                        updateQuestion(
                          question.localId,
                          {
                            placeholder:
                              event
                                .target
                                .value,
                          }
                        )
                      }
                    />

                  </div>


                  <div className="field">

                    <label>
                      ملاحظة توضيحية
                    </label>

                    <input
                      type="text"
                      value={
                        question.helpText
                      }
                      placeholder="تعليمات اختيارية تظهر أسفل السؤال"
                      onChange={(
                        event
                      ) =>
                        updateQuestion(
                          question.localId,
                          {
                            helpText:
                              event
                                .target
                                .value,
                          }
                        )
                      }
                    />

                  </div>

                </div>


                <label className="activity-builder-required">

                  <input
                    type="checkbox"
                    checked={
                      question.required
                    }
                    onChange={(
                      event
                    ) =>
                      updateQuestion(
                        question.localId,
                        {
                          required:
                            event
                              .target
                              .checked,
                        }
                      )
                    }
                  />

                  <span>
                    هذا السؤال إجباري
                  </span>

                </label>


                {needsOptions(
                  question.type
                ) && (
                  <div className="activity-builder-options">

                    <div className="activity-builder-options-head">

                      <div>
                        <strong>
                          خيارات السؤال
                        </strong>

                        <span>
                          أضف الخيارات
                          التي يستطيع
                          الطالب الاختيار
                          منها
                        </span>
                      </div>


                      <button
                        type="button"
                        onClick={() =>
                          addOption(
                            question.localId
                          )
                        }
                      >
                        <Plus
                          size={15}
                        />

                        إضافة خيار
                      </button>

                    </div>


                    <div className="activity-builder-options-list">

                      {question.options.map(
                        (
                          option,
                          optionIndex
                        ) => (
                          <div
                            className="activity-builder-option-row"
                            key={`${question.localId}-${optionIndex}`}
                          >

                            <span>
                              {optionIndex +
                                1}
                            </span>

                            <input
                              type="text"
                              value={
                                option
                              }
                              placeholder={`الخيار ${
                                optionIndex +
                                1
                              }`}
                              onChange={(
                                event
                              ) =>
                                updateOption(
                                  question.localId,
                                  optionIndex,
                                  event
                                    .target
                                    .value
                                )
                              }
                            />

                            <button
                              type="button"
                              aria-label="حذف الخيار"
                              title="حذف الخيار"
                              disabled={
                                question
                                  .options
                                  .length <=
                                1
                              }
                              onClick={() =>
                                removeOption(
                                  question.localId,
                                  optionIndex
                                )
                              }
                            >
                              <Trash2
                                size={
                                  16
                                }
                              />
                            </button>

                          </div>
                        )
                      )}

                    </div>

                  </div>
                )}

              </article>
            )
          )}

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

    </section>
  );
}