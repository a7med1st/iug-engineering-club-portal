export const MEMBER_GROUPS = [
  { value: "ADMINISTRATIVE", label: "الهيئة الإدارية" },
  { value: "PUBLIC_RELATIONS", label: "لجنة العلاقات العامة" },
  { value: "MEMBERS", label: "الأعضاء" },
  { value: "MEDIA", label: "اللجنة الإعلامية" },
] as const;

export type MemberGroupValue = (typeof MEMBER_GROUPS)[number]["value"];

export function parseMemberGroup(value: unknown, fallback: MemberGroupValue = "MEMBERS"): MemberGroupValue {
  if (value === null || value === undefined) return fallback;
  const group = MEMBER_GROUPS.find((group) => group.value === value);
  if (!group) throw new Error("Invalid member group");
  return group.value;
}

export function memberGroupLabel(value: MemberGroupValue): string {
  return MEMBER_GROUPS.find((group) => group.value === value)!.label;
}
