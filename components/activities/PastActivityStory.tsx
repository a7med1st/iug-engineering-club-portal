import Link from "next/link";
import { ArrowLeft, Building2, CalendarDays, Clock3, FileText, ImageIcon, Images, MapPin, Pencil } from "lucide-react";
import { activityScheduleDetails } from "@/lib/activities";
import ActivityGallery from "./ActivityGallery";
import styles from "./PastActivityStory.module.css";

type Props = {
  activity: {
    id: string;
    title: string;
    description: string;
    postEventSummary: string | null;
    coverImageUrl: string | null;
    location: string | null;
    startsAt: Date | null;
    endsAt: Date | null;
    images: { id: string; url: string }[];
  };
  departmentNames: string[];
  canEdit: boolean;
};

export default function PastActivityStory({ activity, departmentNames, canEdit }: Props) {
  const { date, startTime, endTime } = activityScheduleDetails(activity.startsAt, activity.endsAt);
  const timeRange = startTime && (
    <span className={styles.timeRange} dir="rtl">
      {endTime && <span>من</span>}
      <bdi dir="rtl">{startTime}</bdi>
      {endTime && <><span>إلى</span><bdi dir="rtl">{endTime}</bdi></>}
    </span>
  );
  const summary = activity.postEventSummary?.trim();
  const story = summary || activity.description;
  const intro = story.split(/\n\s*\n/)[0].trim();
  const excerpt = intro.length > 175
    ? `${intro.slice(0, 175).trimEnd()}…`
    : "تعرّف على تجربة النشاط، وما نُفّذ خلاله، واستعرض أبرز لحظاته.";
  const cover = activity.coverImageUrl || activity.images[0]?.url;
  const imageCount = activity.images.length;
  const photoCount = imageCount === 1 ? "صورة واحدة" : imageCount === 2 ? "صورتان" : `${imageCount.toLocaleString("ar-PS")} ${imageCount <= 10 ? "صور" : "صورة"}`;

  return (
    <article className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.container}>
          <nav className={styles.breadcrumb} aria-label="مسار التنقل">
            <Link href="/activities?view=past">الأنشطة السابقة</Link><span aria-hidden="true">/</span><span aria-current="page">{activity.title}</span>
          </nav>
          <div className={styles.heroGrid}>
            <div className={styles.heroText}>
              <h1>{activity.title}</h1>
              <p className={styles.intro}>{excerpt}</p>
              <div className={styles.heroMeta}>
                <span><CalendarDays size={17} aria-hidden="true" /><bdi dir="ltr">{date}</bdi></span>
                {timeRange && <span><Clock3 size={17} aria-hidden="true" />{timeRange}</span>}
                {activity.location && <span><MapPin size={17} aria-hidden="true" />{activity.location}</span>}
              </div>
              <div className={styles.heroActions}>
                <a href="#activity-story" className={styles.primaryAction}><FileText size={17} aria-hidden="true" />{summary ? "اقرأ التوثيق" : "عن النشاط"}</a>
                {activity.images.length > 0 && <a href="#activity-photos" className={styles.secondaryAction}><Images size={17} aria-hidden="true" />شاهد الصور</a>}
                {canEdit && <Link href={`/admin/activities/${activity.id}/documentation`} className={styles.manageLink}><Pencil size={15} aria-hidden="true" />إدارة التوثيق</Link>}
              </div>
            </div>
            <div className={styles.cover}>
              {cover ? <img src={cover} alt={`غلاف ${activity.title}`} fetchPriority="high" /> : <div className={styles.coverFallback}><ImageIcon size={54} aria-hidden="true" /><span>النادي الهندسي للطلاب</span></div>}
            </div>
          </div>
        </div>
      </section>

      <div className={`${styles.container} ${styles.content}`}>
        <div className={styles.storyGrid}>
          <section id="activity-story" className={styles.story} aria-labelledby="activity-story-title">
            <h2 id="activity-story-title">{summary ? "عن التجربة" : "عن النشاط"}</h2>
            <div className={styles.storyText}>{story}</div>
          </section>
          <aside className={styles.details} aria-labelledby="activity-details-title">
            <h2 id="activity-details-title">تفاصيل النشاط</h2>
            <dl>
              <div><CalendarDays aria-hidden="true" /><dt>التاريخ</dt><dd><bdi dir="ltr">{date}</bdi></dd></div>
              {timeRange && <div><Clock3 aria-hidden="true" /><dt>الوقت</dt><dd>{timeRange}</dd></div>}
              {activity.location && <div><MapPin aria-hidden="true" /><dt>المكان</dt><dd>{activity.location}</dd></div>}
              <div><Building2 aria-hidden="true" /><dt>القسم المنظّم</dt><dd><ul className={styles.departmentList}>{departmentNames.map((name, index) => <li key={`${index}-${name}`}>{name}</li>)}</ul></dd></div>
            </dl>
          </aside>
        </div>

        {activity.images.length > 0 && <section id="activity-photos" className={styles.gallery} aria-labelledby="activity-photos-title">
          <div className={styles.galleryHeading}>
            <div><h2 id="activity-photos-title"><Images size={22} aria-hidden="true" />لحظات من النشاط</h2><p>اضغط على أي صورة لعرضها بحجم أكبر.</p></div>
            <span className={styles.photoCount}>{photoCount}</span>
          </div>
          <ActivityGallery images={activity.images.map(({ id, url }) => ({ id, url }))} activityTitle={activity.title} layout="story" />
        </section>}

        <div className={styles.back}><Link href="/activities?view=past"><ArrowLeft size={19} aria-hidden="true" />العودة إلى الأنشطة السابقة</Link></div>
      </div>
    </article>
  );
}
