
import { notFound } from "next/navigation";
import {
  ArrowRight,
  BookUser,
  ExternalLink,
  Github,
  Instagram,
  Linkedin,
  Link2,
  Sparkles,
} from "lucide-react";

import { prisma } from "@/lib/prisma";

import AvatarPreview from "./AvatarPreview";
import MemberCoverImage from "./MemberCoverImage";
import styles from "./member-public.module.css";

export const dynamic = "force-dynamic";

export default async function MemberPublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const member = await prisma.user.findFirst({
    where: {
      id,
      role: { in: ["MEMBER", "ADMIN"] },
    },
    select: {
      id: true,
      name: true,
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
        select: { nameAr: true },
      },
      structureItem: {
        select: { title: true },
      },
    },
  });

  if (!member || !member.structureItem) {
    notFound();
  }

  const title =
    member.structureItem.title ??
    member.position ??
    "عضو في النادي الهندسي";

  const initials =
    member.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase() || "EC";

  const avatarVersion =
    member.avatarUpdatedAt?.getTime() ?? 0;

  const coverVersion =
    member.profileCoverUpdatedAt?.getTime() ?? 0;

  const avatarUrl = member.avatarStoredName
    ? `/members/${member.id}/avatar?v=${avatarVersion}`
    : null;

  const coverUrl = member.profileCoverStoredName
    ? `/members/${member.id}/cover?v=${coverVersion}`
    : null;

  const links = [
    member.profileLinkedIn
      ? {
          label: "LinkedIn",
          url: member.profileLinkedIn,
          icon: Linkedin,
        }
      : null,
    member.profileGithub
      ? {
          label: "GitHub",
          url: member.profileGithub,
          icon: Github,
        }
      : null,
    member.profileInstagram
      ? {
          label: "Instagram",
          url: member.profileInstagram,
          icon: Instagram,
        }
      : null,
  ].filter(Boolean) as {
    label: string;
    url: string;
    icon: typeof Linkedin;
  }[];

  return (
    <main className={styles.page} dir="rtl">
      <div className={styles.topBar}>
        <Link href="/delegates" className={styles.backButton}>
          <ArrowRight size={17} />
          العودة إلى الهيكلية
        </Link>
      </div>

      <section className={styles.hero} data-reveal="up">
        <div className={styles.heroCover}>
          <MemberCoverImage src={coverUrl} />
          <div className={styles.heroOverlay} />
        </div>

        <div className={styles.heroContent}>
          <div className={styles.identity}>
            <AvatarPreview
              src={avatarUrl}
              alt={`الصورة الشخصية لـ ${member.name}`}
              initials={initials}
            />

            <div className={styles.identityText}>
              <h1>{member.name}</h1>

              <p className={styles.role}>{title}</p>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.cardsGrid} data-reveal-group="up">
        <article className={styles.infoCard}>
          <div className={styles.cardHead}>
            <div className={styles.cardIcon}>
              <BookUser size={20} />
            </div>

            <div>
              <h2>عن العضو</h2>
              <p>نبذة مختصرة عن العضو ودوره داخل النادي.</p>
            </div>
          </div>

          <div className={styles.cardBody}>
            {member.profileBio?.trim() ? (
              <p className={styles.bodyText}>
                {member.profileBio}
              </p>
            ) : (
              <div className={styles.emptyState}>
                لم تتم إضافة نبذة شخصية بعد.
              </div>
            )}
          </div>
        </article>

        <article className={styles.infoCard}>
          <div className={styles.cardHead}>
            <div className={styles.cardIcon}>
              <Sparkles size={20} />
            </div>

            <div>
              <h2>المهارات والاهتمامات</h2>
              <p>أبرز المهارات والمجالات التي يهتم بها العضو.</p>
            </div>
          </div>

          <div className={styles.cardBody}>
            {member.profileSkills.length ? (
              <div className={styles.skillsList}>
                {member.profileSkills.map((skill) => (
                  <span key={skill}>{skill}</span>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                لم تتم إضافة مهارات أو اهتمامات بعد.
              </div>
            )}
          </div>
        </article>

        <article className={styles.infoCard}>
          <div className={styles.cardHead}>
            <div className={styles.cardIcon}>
              <Link2 size={20} />
            </div>

            <div>
              <h2>روابط العضو</h2>
              <p>الحسابات المهنية والاجتماعية التي اختار العضو مشاركتها.</p>
            </div>
          </div>

          <div className={styles.cardBody}>
            {links.length ? (
              <div className={styles.linksList}>
                {links.map(({ label, url, icon: Icon }) => (
                  <a
                    key={label}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.linkItem}
                  >
                    <Icon size={18} />
                    <span>{label}</span>
                    <ExternalLink size={15} />
                  </a>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                لم تتم إضافة روابط بعد.
              </div>
            )}
          </div>
        </article>
      </section>
    </main>
  );
}
