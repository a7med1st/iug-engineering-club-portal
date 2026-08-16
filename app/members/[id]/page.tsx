import Link from "next/link";
import { notFound } from "next/navigation";

import {
  Github,
  Instagram,
  Linkedin,
  Network,
  UserRound,
} from "lucide-react";

import { prisma } from "@/lib/prisma";

import styles from "./member-public.module.css";

export const dynamic = "force-dynamic";

export default async function PublicMemberProfile({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const { id } = await params;

  const member = await prisma.user.findFirst({
    where: {
      id,
      role: {
        in: ["MEMBER", "ADMIN"],
      },
      structureItem: {
        isNot: null,
      },
    },
    select: {
      id: true,
      name: true,
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
          parent: {
            select: {
              name: true,
              title: true,
            },
          },
        },
      },
    },
  });

  if (!member || !member.structureItem) {
    notFound();
  }

  const initials =
    member.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "EC";

  return (
    <main className={styles.page}>
      <Link
        href="/delegates"
        className={styles.backLink}
      >
        <Network size={17} />
        العودة إلى الهيكلية
      </Link>

      <section className={styles.profileCard}>
        <div
          className={styles.cover}
          style={
            member.profileCoverStoredName
              ? {
                  backgroundImage: `url(/members/${member.id}/cover?v=${member.profileCoverUpdatedAt?.getTime() ?? 0})`,
                }
              : undefined
          }
        />

        <div className={styles.profileBody}>
          <div className={styles.identity}>
            <div className={styles.avatar}>
              {member.avatarStoredName ? (
                <img
                  src={`/members/${member.id}/avatar?v=${member.avatarUpdatedAt?.getTime() ?? 0}`}
                  alt={`صورة ${member.name}`}
                />
              ) : (
                <span>{initials}</span>
              )}
            </div>

            <div>
              <span className={styles.role}>
                {member.structureItem.title}
              </span>
              <h1>{member.name}</h1>
              <p>
                {member.department?.nameAr ??
                  "النادي الهندسي"}
              </p>
            </div>
          </div>

          {member.structureItem.parent && (
            <div className={styles.reportsTo}>
              <span>يتبع تنظيميًا إلى</span>
              <strong>
                {member.structureItem.parent.name}
                {" — "}
                {member.structureItem.parent.title}
              </strong>
            </div>
          )}
        </div>
      </section>

      <div className={styles.contentGrid}>
        <section className={styles.card}>
          <span className={styles.cardEyebrow}>
            نبذة
          </span>
          <h2>عن العضو</h2>
          <p className={styles.bio}>
            {member.profileBio ||
              "لم يضف العضو نبذة شخصية بعد."}
          </p>
        </section>

        <section className={styles.card}>
          <span className={styles.cardEyebrow}>
            Skills
          </span>
          <h2>المهارات والاهتمامات</h2>

          {member.profileSkills.length ? (
            <div className={styles.skills}>
              {member.profileSkills.map(
                (skill) => (
                  <span key={skill}>
                    {skill}
                  </span>
                ),
              )}
            </div>
          ) : (
            <p className={styles.empty}>
              لم تتم إضافة مهارات بعد.
            </p>
          )}
        </section>

        <section
          className={`${styles.card} ${styles.socialCard}`}
        >
          <span className={styles.cardEyebrow}>
            Connect
          </span>
          <h2>روابط العضو</h2>

          <div className={styles.socialLinks}>
            {member.profileLinkedIn && (
              <a
                href={member.profileLinkedIn}
                target="_blank"
                rel="noreferrer"
              >
                <Linkedin size={19} />
                LinkedIn
              </a>
            )}

            {member.profileGithub && (
              <a
                href={member.profileGithub}
                target="_blank"
                rel="noreferrer"
              >
                <Github size={19} />
                GitHub
              </a>
            )}

            {member.profileInstagram && (
              <a
                href={member.profileInstagram}
                target="_blank"
                rel="noreferrer"
              >
                <Instagram size={19} />
                Instagram
              </a>
            )}

            {!member.profileLinkedIn &&
              !member.profileGithub &&
              !member.profileInstagram && (
                <div className={styles.noSocial}>
                  <UserRound size={20} />
                  لم يضف العضو روابط بعد.
                </div>
              )}
          </div>
        </section>
      </div>
    </main>
  );
}
