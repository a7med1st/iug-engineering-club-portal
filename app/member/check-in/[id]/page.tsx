import Link from "next/link";
import { notFound } from "next/navigation";

import {
  ArrowRight,
  CheckCircle2,
  MapPin,
  QrCode,
  Users,
} from "lucide-react";

import MemberCheckInScanner from "@/components/member/MemberCheckInScanner";

import {
  PERMISSIONS,
  requireActivityPermission,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

import styles from "../member-checkin.module.css";

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

export default async function MemberActivityCheckInPage({
  params,
}: Props) {
  const { id } =
    await params;

  await requireActivityPermission(
    PERMISSIONS.ATTENDANCE_SCAN,
    id,
  );

  const activity =
    await prisma.activity.findFirst({
      where: {
        id,
        status: "PUBLISHED",
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
          href="/member/check-in"
          className={
            styles.backLink
          }
        >
          <ArrowRight
            size={18}
          />

          العودة للأنشطة
        </Link>
      </div>

      <section
        className={
          styles.activityHero
        }
      >
        <div>
          <span
            className={
              styles.eyebrow
            }
          >
            تسجيل الحضور
          </span>

          <h1>
            {activity.title}
          </h1>

          <div
            className={
              styles.heroMeta
            }
          >
            <span>
              {formatDate(
                activity.startsAt,
              )}
            </span>

            <span>
              <MapPin
                size={15}
              />

              {
                activity.location
              }
            </span>
          </div>
        </div>

        <QrCode size={34} />
      </section>

      <section
        className={
          styles.quickStats
        }
      >
        <div>
          <Users size={20} />

          <span>
            المقبولون
          </span>

          <strong>
            {approvedCount}
          </strong>
        </div>

        <div>
          <CheckCircle2
            size={20}
          />

          <span>
            حضروا
          </span>

          <strong>
            {checkedInCount}
          </strong>
        </div>

        <div>
          <QrCode size={20} />

          <span>
            بانتظار الحضور
          </span>

          <strong>
            {waitingCount}
          </strong>
        </div>
      </section>

      <MemberCheckInScanner
        activityId={
          activity.id
        }
      />
    </main>
  );
}
