import Link from "next/link";

import {
  ArrowRight,
  ExternalLink,
  ImageIcon,
  UserRound,
} from "lucide-react";

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
  const { user: authUser } =
    await requirePermission(
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

  const avatarVersion =
    user.avatarUpdatedAt?.getTime() ?? 0;

  const coverVersion =
    user.profileCoverUpdatedAt?.getTime() ?? 0;

  return (
    <main className={styles.page}>
      <div className={styles.topBar}>
        <Link
          href="/member"
          className={styles.backLink}
        >
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

      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>
            Member Profile
          </span>
          <h1>ملفي الشخصي</h1>
          <p>
            عدّل النبذة والصور والمهارات والروابط التي ستظهر في صفحتك العامة داخل هيكلية النادي.
          </p>
        </div>
      </section>

      {feedback.error && (
        <div className={styles.error}>
          {feedback.error}
        </div>
      )}

      {feedback.success && (
        <div className={styles.success}>
          {feedback.success}
        </div>
      )}

      <section className={styles.identityCard}>
        <div
          className={styles.coverPreview}
          style={
            user.profileCoverStoredName
              ? {
                  backgroundImage: `url(/members/${user.id}/cover?v=${coverVersion})`,
                }
              : undefined
          }
        >
          {!user.profileCoverStoredName && (
            <ImageIcon size={34} />
          )}
        </div>

        <div className={styles.identityBody}>
          <div className={styles.avatarWrap}>
            {user.avatarStoredName ? (
              <img
                src={`/members/${user.id}/avatar?v=${avatarVersion}`}
                alt={`صورة ${user.name}`}
              />
            ) : (
              <UserRound size={34} />
            )}
          </div>

          <div>
            <h2>{user.name}</h2>
            <p>
              {user.structureItem?.title ??
                user.position ??
                "عضو في النادي الهندسي"}
            </p>
            <span>
              {user.department?.nameAr ??
                "الإدارة العامة"}
            </span>
          </div>
        </div>
      </section>

      <form
        action={updateMemberProfile}
        className={styles.form}
      >
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <div>
              <span>المحتوى</span>
              <h2>نبذة عني</h2>
            </div>
          </div>

          <label>
            النبذة
            <textarea
              name="bio"
              rows={7}
              maxLength={1500}
              defaultValue={user.profileBio ?? ""}
              placeholder="اكتب نبذة مختصرة عنك، اهتماماتك ودورك في النادي..."
            />
          </label>

          <label>
            المهارات
            <textarea
              name="skills"
              rows={4}
              defaultValue={user.profileSkills.join(
                "\n",
              )}
              placeholder={"React\nLeadership\nEmbedded Systems"}
            />
            <small>
              اكتب كل مهارة في سطر أو افصل بينها بفاصلة.
            </small>
          </label>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHead}>
            <div>
              <span>الصور</span>
              <h2>الصورة الشخصية والغلاف</h2>
            </div>
          </div>

          <div className={styles.twoColumns}>
            <label>
              الصورة الشخصية
              <input
                type="file"
                name="avatar"
                accept="image/jpeg,image/png,image/webp"
              />
              <small>
                JPG / PNG / WebP — حتى 5MB
              </small>
            </label>

            <label>
              صورة الغلاف
              <input
                type="file"
                name="cover"
                accept="image/jpeg,image/png,image/webp"
              />
              <small>
                JPG / PNG / WebP — حتى 8MB
              </small>
            </label>
          </div>

          <div className={styles.removeRow}>
            {user.avatarStoredName && (
              <label className={styles.checkLabel}>
                <input
                  type="checkbox"
                  name="removeAvatar"
                />
                حذف الصورة الشخصية الحالية
              </label>
            )}

            {user.profileCoverStoredName && (
              <label className={styles.checkLabel}>
                <input
                  type="checkbox"
                  name="removeCover"
                />
                حذف صورة الغلاف الحالية
              </label>
            )}
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHead}>
            <div>
              <span>التواصل</span>
              <h2>روابط اختيارية</h2>
            </div>
          </div>

          <div className={styles.twoColumns}>
            <label>
              LinkedIn
              <input
                type="url"
                name="linkedIn"
                dir="ltr"
                defaultValue={
                  user.profileLinkedIn ?? ""
                }
                placeholder="https://linkedin.com/in/..."
              />
            </label>

            <label>
              GitHub
              <input
                type="url"
                name="github"
                dir="ltr"
                defaultValue={
                  user.profileGithub ?? ""
                }
                placeholder="https://github.com/..."
              />
            </label>

            <label>
              Instagram
              <input
                type="url"
                name="instagram"
                dir="ltr"
                defaultValue={
                  user.profileInstagram ?? ""
                }
                placeholder="https://instagram.com/..."
              />
            </label>
          </div>
        </section>

        <button
          type="submit"
          className={styles.saveButton}
        >
          حفظ الملف الشخصي
        </button>
      </form>
    </main>
  );
}
