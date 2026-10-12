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

type DepartmentOrder = { slug: string; sortOrder: number };
type GroupedMember = {
  memberGroup: string;
  department?: DepartmentOrder | null;
  user?: { department?: DepartmentOrder | null } | null;
};

export function membersForGroup<T extends GroupedMember>(items: readonly T[], group: MemberGroupValue): T[] {
  const members = items.filter((item) => item.memberGroup === group);
  if (group !== "MEMBERS") return members;
  return members.sort((first, second) => {
    const firstDepartment = first.user?.department ?? first.department;
    const secondDepartment = second.user?.department ?? second.department;
    if (!firstDepartment) return secondDepartment ? 1 : 0;
    if (!secondDepartment) return -1;
    return firstDepartment.sortOrder - secondDepartment.sortOrder ||
      firstDepartment.slug.localeCompare(secondDepartment.slug);
  });
}
