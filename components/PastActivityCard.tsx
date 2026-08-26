import {
  CalendarCheck2,
  CalendarDays,
  MapPin,
  Sparkles,
  ArrowUpLeft,
} from "lucide-react";
import Link from "next/link";

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
  const date = new Intl.DateTimeFormat("ar-PS", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: ACTIVITY_TIME_ZONE,
  }).format(activity.startsAt);

  return (
    <Link
      className="past-activity-card-link"
      href={`/activities/${activity.id}`}
      aria-label={`عرض تفاصيل ${activity.title}`}
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
            <span className="past-activity-department">
              {activityDepartmentLabel(activity, departmentCount)}
            </span>
            <span className="past-activity-badge">تم التنفيذ</span>
          </div>

          <h3>{activity.title}</h3>
          <p>{activity.description}</p>

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

          <span className="past-activity-details-cta">
            عرض التفاصيل
            <ArrowUpLeft aria-hidden="true" />
          </span>
        </div>
      </article>
    </Link>
  );
}
