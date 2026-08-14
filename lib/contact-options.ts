export const STUDY_LEVEL_OPTIONS = [
  {
    value: "FIRST",
    label: "المستوى الأول",
  },
  {
    value: "SECOND",
    label: "المستوى الثاني",
  },
  {
    value: "THIRD",
    label: "المستوى الثالث",
  },
  {
    value: "FOURTH",
    label: "المستوى الرابع",
  },
  {
    value: "FIFTH",
    label: "المستوى الخامس",
  },
  {
    value: "GRADUATE",
    label: "خريج",
  },
] as const;


export const COMPLAINT_TYPE_OPTIONS = [
  {
    value: "COMPLAINT",
    label: "شكوى",
  },
  {
    value: "ORGANIZATIONAL_PROBLEM",
    label: "مشكلة تنظيمية",
  },
  {
    value: "IMPROVEMENT_SUGGESTION",
    label: "اقتراح تحسين",
  },
  {
    value: "INQUIRY",
    label: "استفسار",
  },
  {
    value: "OTHER",
    label: "أخرى",
  },
] as const;


export const ACTIVITY_TYPE_OPTIONS = [
  {
    value: "TRAINING_COURSE",
    label: "دورة تدريبية",
  },
  {
    value: "WORKSHOP",
    label: "ورشة عمل",
  },
  {
    value: "TECH_LECTURE",
    label: "محاضرة تقنية",
  },
  {
    value: "COMPETITION",
    label: "مسابقة",
  },
  {
    value: "DISCUSSION_SESSION",
    label: "جلسة نقاش",
  },
  {
    value: "PRACTICAL_TRAINING",
    label: "تدريب عملي",
  },
] as const;


export const EXPERIENCE_LEVEL_OPTIONS = [
  {
    value: "BEGINNER",
    label: "مبتدئ",
  },
  {
    value: "INTERMEDIATE",
    label: "متوسط",
  },
  {
    value: "ADVANCED",
    label: "متقدم",
  },
] as const;


export const ENTITY_TYPE_OPTIONS = [
  {
    value: "TRAINER",
    label: "مدرب",
  },
  {
    value: "COMPANY",
    label: "شركة",
  },
  {
    value: "EDUCATIONAL_INSTITUTION",
    label: "مؤسسة تعليمية",
  },
  {
    value: "CHARITY",
    label: "منظمة خيرية",
  },
  {
    value: "TECH_COMMUNITY",
    label: "مجتمع تقني",
  },
  {
    value: "INDIVIDUAL",
    label: "فرد",
  },
  {
    value: "OTHER",
    label: "أخرى",
  },
] as const;


export const COOPERATION_TYPE_OPTIONS = [
  {
    value: "TRAINING_COURSE",
    label: "تقديم دورة تدريبية",
  },
  {
    value: "WORKSHOP",
    label: "ورشة عمل",
  },
  {
    value: "LECTURE",
    label: "محاضرة",
  },
  {
    value: "EVENT_SPONSORSHIP",
    label: "رعاية فعالية",
  },
  {
    value: "STRATEGIC_PARTNERSHIP",
    label: "شراكة استراتيجية",
  },
  {
    value: "COMMUNITY_INITIATIVE",
    label: "مبادرة مجتمعية",
  },
  {
    value: "OTHER",
    label: "أخرى",
  },
] as const;


export const CONTACT_STATUS_LABELS = {
  NEW: "جديد",
  IN_REVIEW: "قيد المراجعة",
  RESOLVED: "تم التعامل معه",
  CONTACTED: "تم التواصل",
  ACCEPTED: "مقبول",
  REJECTED: "مرفوض",
} as const;