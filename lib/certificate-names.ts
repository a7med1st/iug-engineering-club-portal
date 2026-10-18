export const CERTIFICATE_NAME_QUESTIONS = {
  ar: { label: "الاسم باللغة العربية", placeholder: "اكتب اسمك الكامل باللغة العربية", helpText: "سيُطبع هذا الاسم على الشهادة العربية. راجع كتابته قبل التسجيل." },
  en: { label: "الاسم باللغة الإنجليزية", placeholder: "Full name in English", helpText: "سيُطبع هذا الاسم على الشهادة الإنجليزية كما تكتبه هنا." },
} as const;

export function certificateNameLanguage(label: string): "ar" | "en" | null {
  const normalized = label.trim().replace(/\s+/g, " ");
  return normalized === CERTIFICATE_NAME_QUESTIONS.ar.label ? "ar" : normalized === CERTIFICATE_NAME_QUESTIONS.en.label ? "en" : null;
}

export function certificateNameError(language: "ar" | "en", name: string) {
  if (!name.trim() || name.length > 160) return "أدخل اسمًا كاملًا لا يتجاوز 160 حرفًا.";
  if (language === "en" && (!/[A-Za-z]/.test(name) || /[\u0600-\u06ff]/.test(name))) return "اكتب الاسم باللغة الإنجليزية ليظهر صحيحًا على الشهادة الإنجليزية.";
  if (language === "ar" && !/[\u0621-\u064a]/.test(name)) return "اكتب الاسم باللغة العربية ليظهر صحيحًا على الشهادة العربية.";
  return null;
}

export function certificateNamesFromAnswers(answers: { value: unknown; question: { label: string } }[], fallbackArabic: string) {
  const names = { ar: fallbackArabic, en: "" };
  for (const answer of answers) {
    const language = certificateNameLanguage(answer.question.label);
    if (language && typeof answer.value === "string" && answer.value.trim()) names[language] = answer.value.trim();
  }
  return names;
}
