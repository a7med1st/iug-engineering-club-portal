import Link from "next/link";
import { notFound } from "next/navigation";

import {
  ArrowRight,
  CheckCircle2,
  QrCode,
  Users,
} from "lucide-react";

import ActivityCheckInScanner from "@/components/admin/ActivityCheckInScanner";

import {
  PERMISSIONS,
  requireActivityPermission,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

import styles from "./check-in.module.css";

export const dynamic =
  "force-dynamic";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

function formatDate(
  date: Date,
) {
  return new Intl.DateTimeFormat(
    "ar-PS",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(date);
}

export default async function ActivityCheckInPage({
  params,
}: Props) {
  const { id } =
    await params;

  await requireActivityPermission(
    PERMISSIONS.REGISTRATION_MANAGE,
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
        location: true,
        startsAt: true,

        registrationForm: {
          select: {
            id: true,
          },
        },
      },
    });

  if (
    !activity ||
    !activity.registrationForm
  ) {
    notFound();
  }

  const formId =
    activity.registrationForm.id;

  const [
    approvedCount,
    checkedInCount,
  ] = await Promise.all([
    prisma.activityFormSubmission.count({
      where: {
        formId,
        status: "APPROVED",
      },
    }),

    prisma.activityFormSubmission.count({
      where: {
        formId,
        status: "APPROVED",

        checkedInAt: {
          not: null,
        },
      },
    }),
  ]);

  const waitingCount =
    Math.max(
      approvedCount -
        checkedInCount,
      0,
    );

  return (
    <main
      className={
        styles.page
      }
    >
      <div
        className={
          styles.topBar
        }
      >
        <Link
          href={`/admin/activities/${activity.id}/registrations`}
          className={
            styles.backLink
          }
        >
          <ArrowRight
            size={18}
          />

          إدارة المسجلين
        </Link>
      </div>

      <section
        className={
          styles.hero
        }
      >
        <div>
          <span
            className={
              styles.eyebrow
            }
          >
            CHECK-IN
          </span>

          <h1>
            تسجيل الحضور
          </h1>

          <p>
            {activity.title}
          </p>
        </div>

        <div
          className={
            styles.activityInfo
          }
        >
          <span>
            {formatDate(
              activity.startsAt,
            )}
          </span>

          <strong>
            {activity.location}
          </strong>
        </div>
      </section>

      <section
        className={
          styles.stats
        }
      >
        <article>
          <span
            className={
              styles.statIcon
            }
          >
            <Users size={21} />
          </span>

          <div>
            <span>
              المقبولون
            </span>

            <strong>
              {approvedCount}
            </strong>
          </div>
        </article>

        <article>
          <span
            className={
              styles.statIcon
            }
          >
            <CheckCircle2
              size={21}
            />
          </span>

          <div>
            <span>
              حضروا
            </span>

            <strong>
              {checkedInCount}
            </strong>
          </div>
        </article>

        <article>
          <span
            className={
              styles.statIcon
            }
          >
            <QrCode size={21} />
          </span>

          <div>
            <span>
              بانتظار الحضور
            </span>

            <strong>
              {waitingCount}
            </strong>
          </div>
        </article>
      </section>

      <ActivityCheckInScanner
        activityId={
          activity.id
        }
      />
    </main>
  );
}
