import { notFound } from "next/navigation";
import ActivityEditor from "@/components/admin/ActivityEditor";
import { activityDateTimeInputValues } from "@/lib/activities";
import { readQuestionCondition } from "@/lib/registration-conditions";
import { PERMISSIONS, isClubLeadership, requireActivityPermission, managedDepartmentIdsForUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function EditActivityPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { id } = await params;
  const { user } = await requireActivityPermission(PERMISSIONS.ACTIVITY_MANAGE, id);
  const isAdmin = user.role === "ADMIN" || isClubLeadership(user.position);
  const managedDepartmentIds = managedDepartmentIdsForUser(user);
  const [activity, departments, feedback] = await Promise.all([
    prisma.activity.findUnique({
      where: { id, deletedAt: null },
      include: {
        sessions: { orderBy: { sortOrder: "asc" }, include: { _count: { select: { attendances: true } } } },
        departments: { select: { departmentId: true } },
        registrationForm: {
          include: {
            questions: {
              orderBy: { sortOrder: "asc" },
              select: { id: true, label: true, type: true, required: true, placeholder: true, condition: true, helpText: true, options: true, _count: { select: { answers: true } } },
            },
          },
        },
      },
    }),
    isAdmin || managedDepartmentIds.length
      ? prisma.department.findMany({
        where: isAdmin ? undefined : { id: { in: managedDepartmentIds } },
        select: { id: true, nameAr: true }, orderBy: { sortOrder: "asc" },
      })
      : Promise.resolve([]),
    searchParams,
  ]);

  if (!activity) notFound();
  const dateInput = (value: Date | null) => value ? activityDateTimeInputValues(value) : { date: "", time: "" };
  const registration = activity.registrationForm;
  const initialDepartmentIds = activity.departments.length
    ? activity.departments.map(item => item.departmentId)
    : departments.map(department => department.id);

  return <ActivityEditor
    activity={{
      id: activity.id,
      title: activity.title,
      description: activity.description,
      cardDescription: activity.cardDescription,
      tickerDescription: activity.tickerDescription,
      location: activity.location,
      capacity: activity.capacity,
      price: activity.price,
      status: activity.status,
      attendanceEnabled: activity.attendanceEnabled,
      coverImageUrl: activity.coverImageUrl,
      postEventSummary: activity.postEventSummary,
      updatedAt: activity.updatedAt.toISOString(),
      start: dateInput(activity.startsAt),
      end: dateInput(activity.endsAt),
      requiredAttendanceCount: activity.requiredAttendanceCount,
      sessions: activity.sessions.map(session => {
        const start = dateInput(session.startsAt), end = dateInput(session.endsAt);
        return { id: session.id, title: session.title, startDate: start.date, startTime: start.time, endDate: end.date, endTime: end.time, attendanceCount: session._count.attendances };
      }),
      registration: {
        title: registration?.title ?? "نموذج التسجيل",
        description: registration?.description ?? "",
        isOpen: registration?.isOpen ?? true,
        requiresAccount: registration?.requiresAccount ?? true,
        open: dateInput(registration?.opensAt ?? null),
        close: dateInput(registration?.closesAt ?? null),
        questions: (registration?.questions ?? []).map(question => ({
          id: question.id, label: question.label, type: question.type, required: question.required,
          placeholder: question.placeholder, helpText: question.helpText,
          condition: readQuestionCondition(question.condition),
          options: Array.isArray(question.options) ? question.options.filter((option): option is string => typeof option === "string") : [],
          answerCount: question._count.answers,
        })),
      },
    }}
    departments={departments}
    initialDepartmentIds={initialDepartmentIds}
    allowGeneral={isAdmin}
    canSave={isAdmin || managedDepartmentIds.length > 0}
    initialError={feedback.error}
    initialSuccess={feedback.success}
  />;
}
