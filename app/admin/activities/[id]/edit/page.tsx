import Link from "next/link";
import { notFound } from "next/navigation";

import {
  PERMISSIONS,
  requireActivityPermission,
} from "@/lib/permissions";

import { prisma } from "@/lib/prisma";

import {
  updateActivityText,
} from "../../../actions";

export const dynamic = "force-dynamic";

export default async function EditActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{
    id: string;
  }>;

  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
}) {
  const { id } = await params;

  await requireActivityPermission(
    PERMISSIONS.ACTIVITY_MANAGE,
    id,
  );

  const activity =
    await prisma.activity.findUnique({
      where: {
        id,
      },

      select: {
        id: true,
        title: true,
        description: true,
        postEventSummary: true,
      },
    });

  if (!activity) {
    notFound();
  }

  const feedback =
    await searchParams;

  return (
    <section className="admin-page">
      <div className="admin-page-head">
        <div>
          <h1>تعديل النشاط</h1>

          <p className="muted">
            تعديل النصوص الظاهرة في صفحة النشاط.
          </p>
        </div>

        <Link
          href={`/activities/${activity.id}`}
          className="ghost-btn"
        >
          عرض النشاط
        </Link>
      </div>

      {feedback.error && (
        <div className="feedback-error">
          {feedback.error}
        </div>
      )}

      {feedback.success && (
        <div className="feedback-success">
          {feedback.success}
        </div>
      )}

      <div className="admin-card">
        <form
          action={updateActivityText}
          className="stack-form"
        >
          <input
            type="hidden"
            name="activityId"
            value={activity.id}
          />

          <label>
            عنوان النشاط

            <input
              type="text"
              name="title"
              defaultValue={
                activity.title
              }
              required
              maxLength={160}
            />
          </label>

          <label>
            وصف النشاط

            <textarea
              name="description"
              defaultValue={
                activity.description
              }
              required
              rows={8}
              maxLength={10000}
            />
          </label>

          <label>
            ملخص الفعالية بعد انتهائها

            <textarea
              name="postEventSummary"
              defaultValue={
                activity.postEventSummary ??
                ""
              }
              rows={8}
              maxLength={10000}
              placeholder="يظهر هذا النص في قسم «عن الفعالية» بعد انتهاء النشاط."
            />
          </label>

          <button
            type="submit"
            className="primary-btn"
          >
            حفظ التعديلات
          </button>
        </form>
      </div>
    </section>
  );
}