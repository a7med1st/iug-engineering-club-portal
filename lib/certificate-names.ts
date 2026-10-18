export const CERTIFICATE_NAME_QUESTIONS = {
  ar: { label: "الاسم باللغة العربية", placeholder: "اكتب اسمك الكامل باللغة العربية", helpText: "سيُطبع هذا الاسم على الشهادة العربية. راجع كتابته قبل التسجيل." },
  en: { label: "الاسم باللغة الإنجليزية", placeholder: "Full name in English", helpText: "سيُطبع هذا الاسم على الشهادة الإنجليزية كما تكتبه هنا." },
} as const;

export function certificateNameLanguage(label: string): "ar" | "en" | null {
  const normalized = label.normalize("NFKC").toLowerCase().replace(/[\u064b-\u065f\u0670\u0640]/g, "").replace(/[أإآ]/g, "ا").replace(/\s+/g, " ").trim();
  const isName = /اسم|\bname\b/.test(normalized);
  if (!isName || /اسم (?:المشروع|النشاط|الدوره|الدورة|الفريق|الشركه|الشركة)|\b(?:project|activity|course|team|company) name\b/.test(normalized)) return null;
  if (/انجليز|انجليش|انجلش|\benglish\b/.test(normalized)) return "en";
  if (/عربي|\barabic\b/.test(normalized)) return "ar";
  return null;
}

export function certificateNameError(language: "ar" | "en", name: string) {
  if (!name.trim() || name.length > 160) return "أدخل اسمًا كاملًا لا يتجاوز 160 حرفًا.";
  if (language === "en" && (!/[A-Za-z]/.test(name) || /[\u0600-\u06ff]/.test(name))) return "اكتب الاسم باللغة الإنجليزية ليظهر صحيحًا على الشهادة الإنجليزية.";
  if (language === "ar" && !/[\u0621-\u064a]/.test(name)) return "اكتب الاسم باللغة العربية ليظهر صحيحًا على الشهادة العربية.";
  return null;
}

export function certificateNamesFromAnswers(answers: { value: unknown; question: { label: string } }[], fallbackArabic: string) {
  const names = { ar: fallbackArabic, en: "" };
  const priorities = { ar: -1, en: -1 };
  for (const answer of answers) {
    const language = certificateNameLanguage(answer.question.label);
    if (!language || typeof answer.value !== "string" || !answer.value.trim()) continue;
    const value = answer.value.trim();
    const priority = (certificateNameError(language, value) ? 0 : 2) + (answer.question.label.trim() === CERTIFICATE_NAME_QUESTIONS[language].label ? 1 : 0);
    if (priority > priorities[language]) { names[language] = value; priorities[language] = priority; }
  }
  return names;
}

export function certificateOverrideLanguage(name: string | null | undefined, fallback: "ar" | "en") {
  if (!name?.trim()) return fallback;
  return /[\u0621-\u064a]/.test(name) ? "ar" : "en";
}
