import Link from "next/link";

import {
  ArrowLeft,
  BookOpenText,
  CalendarDays,
  ExternalLink,
  Info,
  MessageSquareText,
  MessagesSquare,
  Network,
  QrCode,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import {
  ACTIVITY_ADMIN_PERMISSIONS,
  PERMISSIONS,
  hasAnyPermission,
  hasPermission,
  requirePermission,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

import styles from "./member-dashboard.module.css";

export default async function Member() {
  const { user } = await requirePermission(
    PERMISSIONS.MEMBER_DASHBOARD,
  );

  const structureItem = await prisma.clubStructureItem.findUnique({
    where: { userId: user.id },
    select: { title: true },
  });

  const canManageActivities = hasAnyPermission(
    user.role,
    ACTIVITY_ADMIN_PERMISSIONS,
    user.memberPermissions,
  );

  const canScanAttendance = hasPermission(
    user.role,
    PERMISSIONS.ATTENDANCE_SCAN,
    user.memberPermissions,
  );

  const canManageGuides = hasPermission(
    user.role,
    PERMISSIONS.GUIDE_MANAGE,
    user.memberPermissions,
  );

  const canManageStructure = hasPermission(
    user.role,
    PERMISSIONS.STRUCTURE_MANAGE,
    user.memberPermissions,
  );

  const canManageContact = hasPermission(
    user.role,
    PERMISSIONS.CONTACT_MANAGE,
    user.memberPermissions,
  );

  const tools = [
    {
      href: "/member/profile",
      title: "ملفي الشخصي",
      text: "عدّل الصورة والغلاف والنبذة والمهارات وروابطك العامة.",
      icon: UserRound,
      visible: true,
      tone: "blue",
    },
    {
      href: "/member/chat",
      title: "محادثات الأعضاء",
      text: "تواصل مباشرة مع أعضاء النادي والإدارة من داخل الموقع.",
      icon: MessagesSquare,
      visible: true,
      tone: "cyan",
    },
    {
      href: "/admin/activities",
      title: "إدارة أنشطة القسم",
      text: "إدارة الأنشطة والتسجيلات ضمن النطاق المسموح لحسابك.",
      icon: CalendarDays,
      visible: canManageActivities,
      tone: "orange",
    },
    {
      href: "/member/check-in",
      title: "تسجيل حضور الطلاب",
      text: "افتح ماسح QR لأنشطة القسم المسموح لك بتسجيل حضورها.",
      icon: QrCode,
      visible: canScanAttendance,
      tone: "green",
    },
    {
      href: "/admin/guides",
      title: "دليل القسم",
      text: "حدّث محتوى دليل قسمك فقط.",
      icon: BookOpenText,
      visible: canManageGuides,
      tone: "violet",
    },
    {
      href: "/admin/structure",
      title: "الهيكلية",
      text: "إدارة عناصر الهيكلية التي تقع ضمن نطاق صلاحياتك.",
      icon: Network,
      visible: canManageStructure,
      tone: "teal",
    },
    {
      href: "/admin/contact",
      title: "إدارة التواصل",
      text: "متابعة الشكاوى والاقتراحات وطلبات التعاون.",
      icon: MessageSquareText,
      visible: canManageContact,
      tone: "blue",
    },
  ].filter((tool) => tool.visible);

  const title =
    structureItem?.title ||
    user.position ||
    "عضو في النادي الهندسي";

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroGlow} aria-hidden="true" />

        <div className={styles.heroTop}>
          <div className={styles.identity}>
            <div className={styles.avatar}>
              <UserRound size={30} />
            </div>

            <div className={styles.identityCopy}>
              <h1>{user.name}</h1>
              <p>
                {title}
                <span className={styles.identityDot}>•</span>
                {user.department?.nameAr || "الإدارة العامة"}
              </p>
            </div>
          </div>

          <div className={styles.heroActions}>
            {structureItem && (
              <Link
                href={`/members/${user.id}`}
                className={styles.heroGhostButton}
              >
                <ExternalLink size={17} />
                <span>عرض صفحتي</span>
              </Link>
            )}

            <Link href="/member/profile" className={styles.heroButton}>
              <UserRound size={17} />
              <span>تعديل الملف الشخصي</span>
            </Link>
          </div>
        </div>

        <div className={styles.metaBar}>
          <span className={styles.metaPill}>
            <ShieldCheck size={15} />
            صلاحيات مخصصة للحساب
          </span>

          {user.department?.nameAr && (
            <span className={styles.metaPill}>
              <Network size={15} />
              {user.department.nameAr}
            </span>
          )}

          {structureItem && (
            <span className={styles.metaPill}>
              <UserRound size={15} />
              ظاهر في الهيكلية
            </span>
          )}
        </div>
      </section>

      <div className={styles.sectionHead}>
        <div>
          <h2>أدوات العضو</h2>
          <span className={styles.sectionLine} aria-hidden="true" />
        </div>

        <p>تظهر الأدوات حسب الصلاحيات التي منحتها الإدارة لحسابك.</p>
      </div>

      <section className={styles.grid}>
        {tools.map(({ href, title, text, icon: Icon, tone }, index) => {
          const isLastOdd =
            tools.length % 2 === 1 && index === tools.length - 1;

          return (
            <Link
              href={href}
              className={`${styles.card} ${
                isLastOdd ? styles.cardWide : ""
              }`}
              data-tone={tone}
              key={href}
            >
              <div className={styles.cardDecoration} aria-hidden="true" />

              <div className={styles.cardIcon}>
                <Icon size={22} />
              </div>

              <div className={styles.cardBody}>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>

              <span className={styles.cardArrowBox} aria-hidden="true">
                <ArrowLeft size={18} className={styles.cardArrow} />
              </span>
            </Link>
          );
        })}

        {!structureItem && (
          <div className={styles.notice}>
            <div className={styles.noticeIcon}>
              <Info size={20} />
            </div>

            <div>
              <strong>صفحتك العامة غير مفعلة بعد</strong>
              <p>
                عندما تربط الإدارة حسابك بعنصر داخل الهيكلية، سيظهر اسمك فيها
                ويمكن للطلاب والأعضاء فتح ملفك العام.
              </p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}