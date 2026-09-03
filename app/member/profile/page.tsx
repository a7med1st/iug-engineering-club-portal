import Link from "next/link";
import {
  ArrowRight,
  ExternalLink,
  Link2,
  Save,
  Sparkles,
  UserRound,
} from "lucide-react";

import AdminFeedback from "@/components/admin/AdminFeedback";
import MemberProfileMediaManager from "@/components/member/MemberProfileMediaManager";
import {
  PERMISSIONS,
  requirePermission,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

import { updateMemberProfile } from "./actions";
import styles from "./profile.module.css";

export const dynamic = "force-dynamic";

export default async function MemberProfileEditorPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
}) {
  const { user: authUser } = await requirePermission(
    PERMISSIONS.MEMBER_DASHBOARD,
  );

  const feedback = await searchParams;
  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: {
      id: true,
      name: true,
      email: true,
      position: true,
      profileBio: true,
      profileSkills: true,
      profileLinkedIn: true,
      profileGithub: true,
      profileInstagram: true,
      avatarStoredName: true,
      avatarUpdatedAt: true,
      profileCoverStoredName: true,
      profileCoverUpdatedAt: true,
      department: {
        select: {
          nameAr: true,
          slug: true,
        },
      },
      structureItem: {
        select: {
          title: true,
        },
      },
    },
  });

  if (!user) return null;

  const avatarVersion = user.avatarUpdatedAt?.getTime() ?? 0;
  const coverVersion = user.profileCoverUpdatedAt?.getTime() ?? 0;
  const title =
    user.structureItem?.title ?? user.position ?? "عضو في النادي الهندسي";
  const departmentName = user.department?.nameAr ?? "الإدارة العامة";
  const isArchitecture = user.department?.slug === "architecture";
  const initials =
    user.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase() || "EC";

  return (
    <main className={styles.page}>
      <div className={styles.topBar} data-reveal="right">
        <Link href="/member" className={styles.backLink}>
          <ArrowRight size={18} />
          لوحة العضو
        </Link>

        {user.structureItem && (
          <Link
            href={`/members/${user.id}`}
            className={styles.previewLink}
          >
            <ExternalLink size={17} />
            عرض الصفحة العامة
          </Link>
        )}
      </div>

      <section className={styles.hero} data-reveal="up">
        <div className={styles.heroGlow} aria-hidden="true" />
        <div className={styles.heroIcon}>
          <UserRound size={24} />
        </div>
        <div>
          <h1>ملفي الشخصي</h1>
          <p>
            حدّث صورتك وغلافك ونبذتك ومهاراتك وروابطك لتظهر صفحتك العامة بصورة
            احترافية ومتناسقة مع هوية النادي.
          </p>
        </div>
      </section>

      <AdminFeedback error={feedback.error} success={feedback.success} />

      <form action={updateMemberProfile} className={styles.form}>
        <MemberProfileMediaManager
          name={user.name}
          title={title}
          departmentName={departmentName}
          initials={initials}
          avatarUrl={
            user.avatarStoredName
              ? `/members/${user.id}/avatar?v=${avatarVersion}`
              : null
          }
          coverUrl={
            user.profileCoverStoredName
              ? `/members/${user.id}/cover?v=${coverVersion}`
              : null
          }
        />

        <section className={styles.card} data-reveal="up">
          <div className={styles.cardHead}>
            <div className={styles.cardHeadIcon}>
              <Sparkles size={18} />
            </div>
            <div>
              <h2>نبذة عني والمهارات</h2>
              <p>اكتب معلومات مختصرة وواضحة تعرّف الزائر عليك بسرعة.</p>
            </div>
          </div>

          <div className={styles.contentGrid}>
            <label className={styles.fieldCard}>
              <span className={styles.fieldLabel}>النبذة</span>
              <textarea
                name="bio"
                rows={8}
                maxLength={1500}
                defaultValue={user.profileBio ?? ""}
                placeholder="اكتب نبذة مختصرة عنك، اهتماماتك ودورك في النادي..."
              />
              <small>حتى 1500 حرف.</small>
            </label>

            <label className={styles.fieldCard}>
              <span className={styles.fieldLabel}>المهارات</span>
              <textarea
                name="skills"
                rows={8}
                defaultValue={user.profileSkills.join("\n")}
                placeholder={"React\nLeadership\nEmbedded Systems"}
              />
              <small>اكتب كل مهارة في سطر أو افصل بينها بفاصلة.</small>
            </label>
          </div>
        </section>

        <section className={styles.card} data-reveal="up">
          <div className={styles.cardHead}>
            <div className={styles.cardHeadIcon}>
              <Link2 size={18} />
            </div>
            <div>
              <h2>روابط اختيارية</h2>
              <p>أضف حساباتك المهنية أو الاجتماعية التي تريد إظهارها للزوار.</p>
            </div>
          </div>

          <div className={styles.linksGrid}>
            <label className={styles.fieldCard}>
              <span className={styles.fieldLabel}>LinkedIn</span>
              <input
                type="url"
                name="linkedIn"
                dir="ltr"
                defaultValue={user.profileLinkedIn ?? ""}
                placeholder="https://linkedin.com/in/..."
              />
            </label>

<label className={styles.fieldCard}>
  <span className={styles.fieldLabel}>
    {isArchitecture ? "Behance" : "GitHub"}
  </span>

  <input
    type="url"
    name="github"
    dir="ltr"
    defaultValue={user.profileGithub ?? ""}
    placeholder={
      isArchitecture
        ? "https://behance.net/..."
        : "https://github.com/..."
    }
  />
</label>

            <label className={styles.fieldCard}>
              <span className={styles.fieldLabel}>Instagram</span>
              <input
                type="url"
                name="instagram"
                dir="ltr"
                defaultValue={user.profileInstagram ?? ""}
                placeholder="https://instagram.com/..."
              />
            </label>
          </div>
        </section>

        <div className={styles.saveBar}>
          <div>
            <strong>جاهز للحفظ؟</strong>
            <span>سيتم تحديث صفحتك العامة مباشرة بعد حفظ التغييرات.</span>
          </div>
          <button type="submit" className={styles.saveButton}>
            <Save size={18} />
            حفظ الملف الشخصي
          </button>
        </div>
      </form>
    </main>
  );
}
