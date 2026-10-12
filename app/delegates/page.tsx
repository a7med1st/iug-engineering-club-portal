import Link from "next/link";
import { Github, Instagram, Linkedin, Palette, UserRound } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { MEMBER_GROUPS } from "@/lib/member-groups";
import styles from "../members/members.module.css";

export const dynamic = "force-dynamic";

export default async function DelegatesPage() {
  const items = await prisma.clubStructureItem.findMany({
    include: {
      user: { select: {
        id: true, name: true, role: true, avatarStoredName: true, avatarUpdatedAt: true,
        profileLinkedIn: true, profileGithub: true, profileInstagram: true,
        department: { select: { slug: true } },
      } },
    },
    orderBy: [{ level: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return (
    <main className={styles.page} dir="rtl">
      <div className={styles.container}>
        <h1 className={styles.pageTitle}>أعضاء النادي</h1>
        {MEMBER_GROUPS.map((group) => (
          <section key={group.value} className={styles.memberSection} aria-labelledby={`group-${group.value}`}>
            <h2 id={`group-${group.value}`} className={styles.heading}>{group.label}</h2>
            <div className={styles.membersGrid}>
          {items.filter((item) => item.memberGroup === group.value).map((item) => {
            const user = item.user;
            const publicUser = user && (user.role === "MEMBER" || user.role === "ADMIN") ? user : null;
            const name = user?.name ?? item.name;
            const links = [
              publicUser?.profileGithub ? { label: user?.department?.slug === "architecture" ? "Behance" : "GitHub", url: publicUser.profileGithub, icon: user?.department?.slug === "architecture" ? Palette : Github } : null,
              publicUser?.profileLinkedIn ? { label: "LinkedIn", url: publicUser.profileLinkedIn, icon: Linkedin } : null,
              publicUser?.profileInstagram ? { label: "Instagram", url: publicUser.profileInstagram, icon: Instagram } : null,
            ].filter((link) => link !== null);
            const identity = <>
              <span className={styles.portrait}>
                {publicUser?.avatarStoredName ? <img src={`/members/${publicUser.id}/avatar?v=${publicUser.avatarUpdatedAt?.getTime() ?? 0}`} alt={name} loading="lazy" /> : <span className={styles.fallback}><UserRound size={44} aria-hidden="true" /><strong>{name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("")}</strong></span>}
              </span>
              <h3 dir="auto">{name}</h3>
              <span className={styles.role} dir="auto">{item.title}</span>
            </>;
            return <article className={styles.memberCard} key={item.id}>
              {publicUser ? <Link href={`/members/${publicUser.id}`} className={styles.identity} aria-label={`عرض ملف ${name}`}>{identity}</Link> : <div className={styles.identity}>{identity}</div>}
              <div className={styles.socials} dir="ltr">
                {links.map(({ label, url, icon: Icon }) => <a key={label} href={url} target="_blank" rel="noopener noreferrer" aria-label={`${name} - ${label}`} title={label}><Icon size={25} aria-hidden="true" /></a>)}
              </div>
            </article>;
          })}
            </div>
            {!items.some((item) => item.memberGroup === group.value) && <p className={styles.groupEmpty}>لا يوجد أعضاء منشورون في هذه المجموعة حاليًا.</p>}
          </section>
        ))}
      </div>
    </main>
  );
}
