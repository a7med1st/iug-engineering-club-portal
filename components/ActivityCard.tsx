import type {
  Activity,
  ActivityDepartment,
  Department,
} from "@prisma/client";
import { CalendarDays, MapPin, Users, ArrowUpLeft } from "lucide-react";

type ActivityWithDepartments = Activity & {
  departments: Array<ActivityDepartment & { department: Department }>;
};

export default function ActivityCard({
  activity,
  departmentCount,
  past = false,
}: {
  activity: ActivityWithDepartments;
  departmentCount: number;
  past?: boolean;
}) {
  const date = new Intl.DateTimeFormat("ar-PS", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(activity.startsAt);
  const isGeneral =
    activity.departments.length === 0 ||
    (departmentCount > 0 && activity.departments.length === departmentCount);
  const departmentLabel = isGeneral
    ? "عام · جميع الأقسام"
    : [...activity.departments]
        .sort(
          (first, second) =>
            first.department.sortOrder - second.department.sortOrder,
        )
        .map(({ department }) => department.nameAr)
        .join("، ");

  return (
    <article className={`activity-card ${past ? "is-past" : ""}`}>
      <div className="activity-tag">{departmentLabel}</div>
      <div className="activity-copy">
        <div>
          <h3>{activity.title}</h3>
          <p>{activity.description}</p>
        </div>
        <div className="activity-meta">
          <span>
            <CalendarDays size={18} />
            {date}
          </span>
          <span>
            <MapPin size={18} />
            {activity.location}
          </span>
          <span>
            <Users size={18} />
            {activity.capacity} طالب/ة
          </span>
        </div>
      </div>
      {!past && (
        <a
          className="primary-btn activity-register"
          href={activity.formUrl}
          target="_blank"
          rel="noreferrer"
        >
          التسجيل <ArrowUpLeft size={18} />
        </a>
      )}
      {past && <span className="past-badge">نشاط منتهٍ</span>}
    </article>
  );
}
