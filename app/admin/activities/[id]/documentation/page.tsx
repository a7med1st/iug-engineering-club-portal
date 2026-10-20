import { ArrowLeft, ArrowRight, CalendarDays, Images, MapPin } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import ActivityDocumentationDeleteForm from "@/components/admin/ActivityDocumentationDeleteForm";
import ActivityDocumentationUploadForm from "@/components/admin/ActivityDocumentationUploadForm";
import AdminFeedback from "@/components/admin/AdminFeedback";
import ActivityDocumentationEditor from "@/components/admin/ActivityDocumentationEditor";
import {
  ACTIVITY_TIME_ZONE,
  activityDepartmentLabel,
  isPastActivity,
} from "@/lib/activities";
import { PERMISSIONS, requireActivityPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

import {
  moveActivityGalleryImage,
} from "./actions";
import styles from "./documentation.module.css";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
};

export default async function ActivityDocumentationPage({
  params,
  searchParams,
}: Props) {
  const { id } = await params;
  await requireActivityPermission(PERMISSIONS.ACTIVITY_MANAGE, id);

  const [activity, departmentCount, feedback] = await Promise.all([
    prisma.activity.findUnique({
      where: { id },
      include: {
        sessions: { select: { startsAt: true, endsAt: true } },
        departments: { include: { department: true } },
        images: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      },
    }),
    prisma.department.count(),
    searchParams,
  ]);

  if (!activity) notFound();

  const date = activity.startsAt
    ? new Intl.DateTimeFormat("ar-PS", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: ACTIVITY_TIME_ZONE,
    }).format(activity.startsAt)
    : "الموعد غير محدد";

  return (
    <section className={`admin-page ${styles.page}`}>
      <div className={styles.topbar} data-reveal="right">
        <div>
          <span className={styles.kicker}>الأنشطة / توثيق النشاط</span>
          <h1>توثيق النشاط</h1>
          <p>
            وثّق التجربة وشارك أبرز لحظاتها مع زوار الموقع.
          </p>
        </div>

        <div className={styles.topbarActions}>
          {activity.status !== "DRAFT" && (
            <Link className="ghost-btn" href={`/activities/${activity.id}`}>
              معاينة الصفحة العامة
            </Link>
          )}
          <Link className="ghost-btn" href="/admin/activities">
            <ArrowRight aria-hidden="true" />
            العودة إلى الأنشطة
          </Link>
        </div>
      </div>

      <AdminFeedback error={feedback.error} success={feedback.success} />

      <article className={styles.activitySummary} data-reveal="scale">
        <div>
          <h2>{activity.title}</h2>
          <span className={isPastActivity(activity) ? styles.pastBadge : styles.currentBadge}>
            {isPastActivity(activity) ? "تم التنفيذ" : "نشاط حالي أو قادم"}
          </span>
        </div>
        <div className={styles.activityMeta}>
          <span>
            <CalendarDays aria-hidden="true" />
            {date}
          </span>
          <span>
            <MapPin aria-hidden="true" />
            {activity.location}
          </span>
          <span>
            <Images aria-hidden="true" />
            {activityDepartmentLabel(activity, departmentCount)}
          </span>
        </div>
      </article>

      <ActivityDocumentationEditor key={activity.id} activity={{ id: activity.id, title: activity.title, description: activity.description, postEventSummary: activity.postEventSummary, coverImageUrl: activity.coverImageUrl, images: activity.images.map(({ id, url }) => ({ id, url })) }}>
      <section
        className={`${styles.panel} ${styles.galleryPanel}`}
        data-reveal="up"
      >
        <div className={styles.panelHeading}>
          <div>
            <h2>صور النشاط</h2>
            <p>أضف لحظات من النشاط، واستخدم الأسهم لتغيير ترتيب الصور. تُحفظ تغييرات الصور مباشرة.</p>
          </div>
          <strong className={styles.count}>{activity.images.length} صورة</strong>
        </div>

        {activity.images.length > 0 && (
          <div className={styles.galleryAdminGrid}>
            {activity.images.map((image, index) => (
              <article className={styles.galleryAdminCard} key={image.id}>
                <div className={styles.galleryImageWrap}>
                  <img
                    src={image.url}
                    alt={`صورة ${index + 1} من ${activity.title}`}
                  />
                </div>
                <div className={styles.galleryCardActions}>
                  <div className={styles.reorderActions}>
                    <form action={moveActivityGalleryImage}>
                      <input type="hidden" name="activityId" value={activity.id} />
                      <input type="hidden" name="imageId" value={image.id} />
                      <input type="hidden" name="direction" value="up" />
                      <button
                        type="submit"
                        className="ghost-btn"
                        disabled={index === 0}
                        aria-label="نقل الصورة إلى ترتيب سابق"
                      >
                        <ArrowRight aria-hidden="true" />
                      </button>
                    </form>
                    <form action={moveActivityGalleryImage}>
                      <input type="hidden" name="activityId" value={activity.id} />
                      <input type="hidden" name="imageId" value={image.id} />
                      <input type="hidden" name="direction" value="down" />
                      <button
                        type="submit"
                        className="ghost-btn"
                        disabled={index === activity.images.length - 1}
                        aria-label="نقل الصورة إلى ترتيب لاحق"
                      >
                        <ArrowLeft aria-hidden="true" />
                      </button>
                    </form>
                  </div>
                  <ActivityDocumentationDeleteForm
                    activityId={activity.id}
                    imageId={image.id}
                    kind="gallery"
                  />
                </div>
              </article>
            ))}
          </div>
        )}

        <ActivityDocumentationUploadForm
          key={activity.images.map((image) => image.id).join(":")}
          activityId={activity.id}
          kind="gallery"
        />
      </section>
        <section className={styles.panel}>
          <div className={styles.panelHeading}>
            <div>
              <h2>صورة غلاف الفعالية</h2>
            </div>
            {activity.coverImagePathname && (
              <ActivityDocumentationDeleteForm
                activityId={activity.id}
                kind="cover"
              />
            )}
          </div>

          {activity.coverImageUrl ? (
            <div className={styles.coverPreview}>
              <img src={activity.coverImageUrl} alt={`غلاف ${activity.title}`} />
            </div>
          ) : (
            <div className={styles.coverFallback}>
              <Images aria-hidden="true" />
              <strong>لم تُضف صورة غلاف بعد</strong>
              <span>سيظهر للزائر غلاف بديل من هوية النادي.</span>
            </div>
          )}

          <ActivityDocumentationUploadForm
            key={activity.coverImageUrl ?? "no-cover"}
            activityId={activity.id}
            kind="cover"
            hasCurrentImage={Boolean(activity.coverImageUrl)}
          />
        </section>
      </ActivityDocumentationEditor>

    </section>
  );
}
