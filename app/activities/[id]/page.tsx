import type { Metadata } from "next";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  ImageIcon,
  MapPin,
  Users,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import ActivityGallery from "@/components/activities/ActivityGallery";
import {
  activityDepartmentLabel,
  formatActivitySchedule,
  isPastActivity,
} from "@/lib/activities";
import { prisma } from "@/lib/prisma";

import styles from "./activity-details.module.css";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

async function publicActivity(id: string) {
  return prisma.activity.findFirst({
    where: {
      id,
      status: { in: ["PUBLISHED", "ARCHIVED"] },
    },
    include: {
      departments: { include: { department: true } },
      images: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
    },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const activity = await prisma.activity.findFirst({
    where: {
      id,
      status: { in: ["PUBLISHED", "ARCHIVED"] },
    },
    select: {
      title: true,
      description: true,
      postEventSummary: true,
    },
  });

  if (!activity) {
    return { title: "النشاط غير موجود | النادي الهندسي للطلاب" };
  }

  return {
    title: `${activity.title} | النادي الهندسي للطلاب`,
    description: (activity.postEventSummary || activity.description).slice(
      0,
      160,
    ),
  };
}

export default async function ActivityDetailsPage({ params }: Props) {
  const { id } = await params;
  const [activity, departmentCount] = await Promise.all([
    publicActivity(id),
    prisma.department.count(),
  ]);

  if (!activity) notFound();

  const past = isPastActivity(activity);
  const date = formatActivitySchedule(activity.startsAt, activity.endsAt);
  const departmentLabel = activityDepartmentLabel(activity, departmentCount);
  const backHref = past ? "/activities?view=past" : "/activities";

  return (
    <article className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroPattern} aria-hidden="true" />
        <div className={`shell ${styles.heroShell}`}>
          <div className={styles.cover}>
            {activity.coverImageUrl ? (
              <img src={activity.coverImageUrl} alt={`غلاف ${activity.title}`} />
            ) : (
              <div className={styles.coverFallback}>
                <ImageIcon aria-hidden="true" />
                <span>النادي الهندسي للطلاب</span>
              </div>
            )}
          </div>

          <div className={styles.heroContent}>
            <div className={styles.badges}>
              {past && (
                <span className={styles.completedBadge}>
                  <CheckCircle2 aria-hidden="true" />
                  تم التنفيذ
                </span>
              )}
              <span className={styles.departmentBadge}>{departmentLabel}</span>
            </div>
            <h1>{activity.title}</h1>
            <p>{activity.description}</p>

          </div>
        </div>
      </section>

      <div className={`shell ${styles.content}`}>
        <section className={styles.aboutSection}>
          <div className={styles.sectionTitle}>
            <span>{past ? "توثيق الفعالية" : "معلومات النشاط"}</span>
            <h2>{past ? "عن الفعالية" : "تفاصيل النشاط"}</h2>
          </div>
          <p>{
            past
              ? activity.postEventSummary || activity.description
              : activity.description
          }</p>
        </section>

        <section className={styles.infoGrid} aria-label="معلومات النشاط">
          <div className={styles.infoCard}>
            <CalendarDays aria-hidden="true" />
            <span>التاريخ</span>
            <strong>{date}</strong>
          </div>
          <div className={styles.infoCard}>
            <MapPin aria-hidden="true" />
            <span>المكان</span>
            <strong>{activity.location}</strong>
          </div>
          <div className={styles.infoCard}>
            <Building2 aria-hidden="true" />
            <span>القسم المنظم</span>
            <strong>{departmentLabel}</strong>
          </div>
          <div className={styles.infoCard}>
            <Users aria-hidden="true" />
            <span>السعة</span>
            <strong>{activity.capacity} طالب/ة</strong>
          </div>
        </section>

        {past && activity.images.length > 0 && (
          <section className={styles.gallerySection}>
            <div className={styles.sectionTitle}>
              <span>لحظات موثقة</span>
              <h2>صور من الفعالية</h2>
            </div>
            <ActivityGallery
              images={activity.images.map(({ id: imageId, url }) => ({
                id: imageId,
                url,
              }))}
              activityTitle={activity.title}
            />
          </section>
        )}

        <div className={styles.backRow}>
          <Link className="ghost-btn fancy-outline-btn" href={backHref}>
            <span>
              {past
                ? "العودة إلى الأنشطة السابقة"
                : "العودة إلى الأنشطة الحالية والقادمة"}
            </span>
            <ArrowLeft aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}
