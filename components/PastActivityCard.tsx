import {
  CalendarCheck2,
  CalendarDays,
  MapPin,
  Sparkles,
  ArrowUpLeft,
} from "lucide-react";
import Link from "next/link";
import ActivityDepartmentChips from "./ActivityDepartmentChips";

import {
  ACTIVITY_TIME_ZONE,
  activityDepartmentLabel,
  type PastActivityCardData,
} from "@/lib/activities";

export default function PastActivityCard({
  activity,
  departmentCount,
}: {
  activity: PastActivityCardData;
  departmentCount: number;
}) {
  const isGeneral = activity.departments.length === 0 || (departmentCount > 0 && activity.departments.length === departmentCount);
  const departmentNames = isGeneral
    ? [activityDepartmentLabel(activity, departmentCount)]
    : [...activity.departments]
        .sort((first, second) => first.department.sortOrder - second.department.sortOrder)
        .map(({ department }) => department.nameAr);
  const date = activity.startsAt
    ? new Intl.DateTimeFormat("ar-PS", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: ACTIVITY_TIME_ZONE,
    }).format(activity.startsAt)
    : "الموعد غير محدد";

  return (
    <div
      className="past-activity-card-link"
    >
      <article className="past-activity-card">
        <div
          className={`past-activity-visual ${
            activity.coverImageUrl ? "has-cover" : ""
          }`}
          aria-hidden={!activity.coverImageUrl}
        >
          {activity.coverImageUrl ? (
            <img
              className="past-activity-cover"
              src={activity.coverImageUrl}
              alt={`غلاف ${activity.title}`}
            />
          ) : (
            <>
              <span className="past-activity-visual-orbit" />
              <CalendarCheck2 />
              <Sparkles className="past-activity-sparkle" />
            </>
          )}
        </div>

        <div className="past-activity-body">
          <div className="past-activity-card-head">
            <ActivityDepartmentChips names={departmentNames} />
            <span className="past-activity-badge">{activity.postEventSummary?.trim() ? "نشاط موثّق" : "تم التنفيذ"}</span>
          </div>

          <h3>{activity.title}</h3>
          <p>{activity.postEventSummary?.trim() || activity.description}</p>

          <div className="past-activity-meta">
            <span>
              <CalendarDays aria-hidden="true" />
              {date}
            </span>
            <span>
              <MapPin aria-hidden="true" />
              {activity.location}
            </span>
          </div>

          <Link className="past-activity-details-cta" href={`/activities/${activity.id}`} aria-label={`عرض تفاصيل ${activity.title}`}>
            {activity.postEventSummary?.trim() ? "اقرأ التوثيق" : "عرض التفاصيل"}
            <ArrowUpLeft aria-hidden="true" />
          </Link>
        </div>
      </article>
    </div>
  );
}
