import type { Activity, Department } from "@prisma/client";
import { CalendarDays, MapPin, Users, ArrowUpLeft } from "lucide-react";

type A = Activity & { department: Department | null };
export default function ActivityCard({ activity, past = false }: { activity: A; past?: boolean }) {
  const date = new Intl.DateTimeFormat("ar-PS", { dateStyle: "full", timeStyle: "short" }).format(activity.startsAt);
  return (
    <article className={`activity-card ${past ? "is-past" : ""}`}>
      <div className="activity-tag">{activity.department?.nameAr || "عام · جميع الأقسام"}</div>
      <div className="activity-copy">
        <div><h3>{activity.title}</h3><p>{activity.description}</p></div>
        <div className="activity-meta">
          <span><CalendarDays size={18}/>{date}</span>
          <span><MapPin size={18}/>{activity.location}</span>
          <span><Users size={18}/>{activity.capacity} طالب/ة</span>
        </div>
      </div>
      {!past && <a className="primary-btn activity-register" href={activity.formUrl} target="_blank" rel="noreferrer">التسجيل <ArrowUpLeft size={18}/></a>}
      {past && <span className="past-badge">نشاط منتهٍ</span>}
    </article>
  );
}
