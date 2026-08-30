import type {
  Activity,
  ActivityDepartment,
  Department,
  Prisma,
} from "@prisma/client";

export const ACTIVITY_TIME_ZONE = "Asia/Hebron";

export type PublicActivity = Activity & {
  departments: Array<ActivityDepartment & { department: Department }>;
};

export type PastActivityCardData = Pick<
  Activity,
  | "id"
  | "title"
  | "description"
  | "location"
  | "startsAt"
  | "coverImageUrl"
> & {
  departments: Array<{
    department: Pick<Department, "nameAr" | "sortOrder">;
  }>;
};

export function isPastActivity(
  activity: Pick<Activity, "startsAt" | "endsAt">,
  referenceTime: Date = new Date(),
) {
  return (activity.endsAt ?? activity.startsAt).getTime() < referenceTime.getTime();
}

export function pastActivityWhere(
  referenceTime: Date = new Date(),
): Prisma.ActivityWhereInput {
  return {
    status: { in: ["PUBLISHED", "ARCHIVED"] },
    OR: [
      { endsAt: { lt: referenceTime } },
      { endsAt: null, startsAt: { lt: referenceTime } },
    ],
  };
}

export function currentActivityWhere(
  referenceTime: Date = new Date(),
): Prisma.ActivityWhereInput {
  return {
    status: "PUBLISHED",
    OR: [
      { startsAt: { gte: referenceTime } },
      { endsAt: { gte: referenceTime } },
    ],
  };
}

export function formatActivitySchedule(
  startsAt: Date,
  endsAt?: Date | null,
  locale = "ar-PS",
  timeZone = ACTIVITY_TIME_ZONE,
) {
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
