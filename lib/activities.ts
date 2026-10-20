import type {
  Activity,
  ActivityDepartment,
  Department,
  Prisma,
} from "@prisma/client";

export const ACTIVITY_TIME_ZONE = "Asia/Gaza";

export function formatActivityTimestamp(date: Date | null, locale = "ar-PS") {
  if (!date) return "";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: ACTIVITY_TIME_ZONE,
  }).format(date);
}

export type PublicActivity = Activity & {
  sessions: Array<Pick<Activity, "startsAt" | "endsAt">>;
  departments: Array<ActivityDepartment & { department: Department }>;
};

export type PastActivityCardData = Pick<
  Activity,
  | "id"
  | "title"
  | "description"
  | "postEventSummary"
  | "location"
  | "startsAt"
  | "coverImageUrl"
> & {
  departments: Array<{
    department: Pick<Department, "nameAr" | "sortOrder">;
  }>;
};

export function isPastActivity(
  activity: Pick<Activity, "startsAt" | "endsAt"> & {
    sessions?: Array<Pick<Activity, "startsAt" | "endsAt">>;
  },
  referenceTime: Date = new Date(),
): boolean {
  if (activity.sessions?.length) {
    return activity.sessions.every((session) =>
      isPastActivity(
        session.startsAt || session.endsAt ? session : { startsAt: activity.startsAt, endsAt: activity.endsAt },
        referenceTime,
      ),
    );
  }
  const activityEnd = activity.endsAt ?? activity.startsAt;
  return activityEnd
    ? activityEnd.getTime() <= referenceTime.getTime()
    : false;
}

// Sessions without their own schedule inherit the activity schedule.
function endedScheduleWhere(referenceTime: Date) {
  return {
    OR: [
      { endsAt: { lte: referenceTime } },
      { endsAt: null, startsAt: { lte: referenceTime } },
    ],
  };
}

export function pastActivityWhere(
  referenceTime: Date = new Date(),
): Prisma.ActivityWhereInput {
  const ended = endedScheduleWhere(referenceTime);
  const unscheduled = { startsAt: null, endsAt: null };
  return {
    status: "PUBLISHED",
    OR: [
      // Every session has finished using its own schedule.
      { sessions: { some: {}, every: ended } },
      // Undated sessions use the activity's end instead of blocking it forever.
      {
        ...ended,
        sessions: { every: { OR: [ended, unscheduled] } },
      },
    ],
  };
}

export function currentActivityWhere(
  referenceTime: Date = new Date(),
): Prisma.ActivityWhereInput {
  const current = {
    OR: [
      { endsAt: { gt: referenceTime } },
      { endsAt: null, startsAt: { gt: referenceTime } },
      { startsAt: null, endsAt: null },
    ],
  };
  return {
    status: "PUBLISHED",
    OR: [
      {
        sessions: { some: { OR: [
          { endsAt: { gt: referenceTime } },
          { endsAt: null, startsAt: { gt: referenceTime } },
        ] } },
      },
      { ...current, sessions: { none: {} } },
      { ...current, sessions: { some: { startsAt: null, endsAt: null } } },
    ],
  };
}

export function formatActivitySchedule(
  startsAt: Date | null,
  endsAt?: Date | null,
  locale = "ar-PS",
  timeZone = ACTIVITY_TIME_ZONE,
) {
  if (!startsAt) return "يُحدد الموعد لاحقًا";

  const formatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  });
  const start = formatter.format(startsAt);

  return endsAt
    ? `${start} - ${formatter.format(endsAt)}`
    : start;
}

export function activityScheduleDetails(
  startsAt: Date | null,
  endsAt: Date | null,
  timeZone = ACTIVITY_TIME_ZONE,
) {
  const first = startsAt ?? endsAt;
  if (!first) return { date: "يُحدد الموعد لاحقاً", time: null };

  const dateFormatter = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "2-digit", year: "numeric", timeZone,
  });
  const timeFormatter = new Intl.DateTimeFormat("ar-PS-u-nu-latn", {
    hour: "numeric", minute: "2-digit", hour12: true, timeZone,
  });
  const startDate = dateFormatter.format(first);
  const endDate = endsAt ? dateFormatter.format(endsAt) : startDate;
  const startTime = timeFormatter.format(first);
  const endTime = endsAt ? timeFormatter.format(endsAt) : startTime;

  return {
    date: startDate === endDate ? startDate : `${startDate} – ${endDate}`,
    time: startDate === endDate && startTime === endTime
      ? startTime
      : `${startTime} – ${endTime}`,
  };
}

export function activityYear(
  startsAt: Date,
  timeZone = ACTIVITY_TIME_ZONE,
) {
  return Number(
    new Intl.DateTimeFormat("en", {
      year: "numeric",
      timeZone,
    }).format(startsAt),
  );
}

function zonedDateTimeParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, Number(value)]),
  );

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

export function activityDateTimeInputValues(
  startsAt: Date,
  timeZone = ACTIVITY_TIME_ZONE,
) {
  const parts = zonedDateTimeParts(startsAt, timeZone);
  const pad = (value: number) => String(value).padStart(2, "0");

  return {
    date: `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`,
    time: `${pad(parts.hour)}:${pad(parts.minute)}`,
  };
}

export function activityDateTimeFromInput(
  dateValue: string,
  timeValue: string,
  timeZone = ACTIVITY_TIME_ZONE,
) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeValue);

  if (!dateMatch || !timeMatch) {
    return null;
  }

  const desired = {
    year: Number(dateMatch[1]),
    month: Number(dateMatch[2]),
    day: Number(dateMatch[3]),
    hour: Number(timeMatch[1]),
    minute: Number(timeMatch[2]),
    second: 0,
  };

  if (
    desired.year < 2000 ||
    desired.year > 2100 ||
    desired.month < 1 ||
    desired.month > 12 ||
    desired.day < 1 ||
    desired.day > 31 ||
    desired.hour < 0 ||
    desired.hour > 23 ||
    desired.minute < 0 ||
    desired.minute > 59
  ) {
    return null;
  }

  const desiredAsUtc = Date.UTC(
    desired.year,
    desired.month - 1,
    desired.day,
    desired.hour,
    desired.minute,
  );
  const calendarCheck = new Date(desiredAsUtc);

  if (
    calendarCheck.getUTCFullYear() !== desired.year ||
    calendarCheck.getUTCMonth() + 1 !== desired.month ||
    calendarCheck.getUTCDate() !== desired.day
  ) {
    return null;
  }

  let instant = desiredAsUtc;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const local = zonedDateTimeParts(new Date(instant), timeZone);
    const localAsUtc = Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      local.hour,
      local.minute,
      local.second,
    );
    instant += desiredAsUtc - localAsUtc;
  }

  const result = new Date(instant);
  const verified = zonedDateTimeParts(result, timeZone);

  if (
    verified.year !== desired.year ||
    verified.month !== desired.month ||
    verified.day !== desired.day ||
    verified.hour !== desired.hour ||
    verified.minute !== desired.minute
  ) {
    return null;
  }

  return result;
}

function startOfYearInTimeZone(year: number, timeZone: string) {
  const utcGuess = new Date(Date.UTC(year, 0, 1));
  const localAtGuess = zonedDateTimeParts(utcGuess, timeZone);
  const offset =
    Date.UTC(
      localAtGuess.year,
      localAtGuess.month - 1,
      localAtGuess.day,
      localAtGuess.hour,
      localAtGuess.minute,
      localAtGuess.second,
    ) - utcGuess.getTime();

  return new Date(utcGuess.getTime() - offset);
}

export function activityYearRange(
  year: number,
  timeZone = ACTIVITY_TIME_ZONE,
) {
  return {
    gte: startOfYearInTimeZone(year, timeZone),
    lt: startOfYearInTimeZone(year + 1, timeZone),
  };
}

export function activityDepartmentLabel(
  activity: {
    departments: Array<{
      department: Pick<Department, "nameAr" | "sortOrder">;
    }>;
  },
  departmentCount: number,
) {
  const isGeneral =
    activity.departments.length === 0 ||
    (departmentCount > 0 &&
      activity.departments.length === departmentCount);

  if (isGeneral) {
    return "عام · جميع الأقسام";
  }

  return [...activity.departments]
    .sort(
      (first, second) =>
        first.department.sortOrder - second.department.sortOrder,
    )
    .map(({ department }) => department.nameAr)
    .join("، ");
}
