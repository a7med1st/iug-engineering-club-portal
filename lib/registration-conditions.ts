export type QuestionCondition = { questionIndex: number; value: string };

export function readQuestionCondition(raw: unknown): QuestionCondition | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const condition = raw as Record<string, unknown>;
  return Number.isInteger(condition.questionIndex) && Number(condition.questionIndex) >= 0 && typeof condition.value === "string" && condition.value.trim()
    ? { questionIndex: Number(condition.questionIndex), value: condition.value.trim() }
    : null;
}

export function visibleQuestionIds(
  questions: readonly { id: string; condition?: unknown }[],
  values: Record<string, string | string[]>,
): Set<string> {
  const visible = new Set<string>();
  questions.forEach((question, index) => {
    const condition = readQuestionCondition(question.condition);
    if (!condition) { visible.add(question.id); return; }
    const parent = questions[condition.questionIndex];
    if (!parent || condition.questionIndex >= index || !visible.has(parent.id)) return;
    const answer = values[parent.id];
    if (Array.isArray(answer) ? answer.includes(condition.value) : answer === condition.value) visible.add(question.id);
  });
  return visible;
}

export function validateQuestionConditions(questions: readonly { type: string; options: string[]; condition: unknown }[]) {
  questions.forEach((question, index) => {
    if (question.condition == null) return;
    const condition = readQuestionCondition(question.condition);
    const parent = condition ? questions[condition.questionIndex] : undefined;
    if (!condition || condition.questionIndex >= index || !parent || !["SELECT", "RADIO", "CHECKBOX"].includes(parent.type) || !parent.options.includes(condition.value)) {
      throw new Error(`شرط ظهور السؤال رقم ${index + 1} غير صالح. اختر سؤال خيارات سابقًا وإجابة موجودة ضمن خياراته.`);
    }
  });
}
