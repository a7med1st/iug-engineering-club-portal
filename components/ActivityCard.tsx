import {
  CalendarDays,
  MapPin,
  Users,
  Banknote,
  ArrowUpLeft,
} from "lucide-react";

import {
  activityDepartmentLabel,
  formatActivitySchedule,
  isPastActivity,
  type PublicActivity,
} from "@/lib/activities";

export default function ActivityCard({
  activity,
  departmentCount,
  past = false,
}: {
  activity: PublicActivity;
  departmentCount: number;
  past?: boolean;
}) {
  const isPast =
    past ||
    isPastActivity(activity);

  const date =
    formatActivitySchedule(
      activity.startsAt,
      activity.endsAt,
    );

  const departmentLabel =
    activityDepartmentLabel(
      activity,
      departmentCount,
    );

  const cardDescription =
    activity.cardDescription?.trim() ||
    activity.description?.trim() ||
    "";

  return (
    <article
      className={`activity-card ${
        isPast ? "is-past" : ""
      }`}
    >
      <div className="activity-tag">
        {departmentLabel}
      </div>

      <div className="activity-copy">
        <div>
          <h3>
            {activity.title}
          </h3>

          {cardDescription && (
            <p>
              {cardDescription}
            </p>
          )}
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

          {activity.price !== null &&
            activity.price > 0 && (
              <span>
                <Banknote size={18} />
                {activity.price} ₪
              </span>
            )}

          <span>
            <Users size={18} />
            {activity.capacity} طالب/ة
          </span>
        </div>
      </div>

      {!isPast && (
        <a
          className="primary-btn activity-register fancy-primary-btn"
          href={`/activities/${activity.id}/register`}
        >
          <span>
            التسجيل
          </span>

          <ArrowUpLeft size={18} />
        </a>
      )}

      {isPast && (
        <span className="past-badge">
          نشاط منتهٍ
        </span>
      )}
    </article>
  );
}