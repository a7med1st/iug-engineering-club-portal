import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Github, Instagram, Linkedin, Palette } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { memberGroupLabel } from "@/lib/member-groups";
import AvatarPreview from "./AvatarPreview";
import styles from "./member-public.module.css";

export const dynamic = "force-dynamic";

export default async function MemberPublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const member = await prisma.user.findFirst({
    where: { id, role: { in: ["MEMBER", "ADMIN"] } },
    select: {
      id: true, name: true, position: true, profileBio: true, profileSkills: true,
      profileLinkedIn: true, profileGithub: true, profileInstagram: true,
      avatarStoredName: true, avatarUpdatedAt: true,
      department: { select: { slug: true } },
      structureItem: { select: { title: true, memberGroup: true } },
    },
  });
  if (!member || !member.structureItem) notFound();
  const title = member.structureItem.title || member.position || "عضو النادي";
  const initials = member.name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join("").toUpperCase() || "EC";
  const avatarUrl = member.avatarStoredName ? `/members/${member.id}/avatar?v=${member.avatarUpdatedAt?.getTime() ?? 0}` : null;
  const isArchitecture = member.department?.slug === "architecture";
  const links = [
    member.profileLinkedIn ? { label: "LinkedIn", url: member.profileLinkedIn, icon: Linkedin } : null,
    member.profileGithub ? { label: isArchitecture ? "Behance" : "GitHub", url: member.profileGithub, icon: isArchitecture ? Palette : Github } : null,
    member.profileInstagram ? { label: "Instagram", url: member.profileInstagram, icon: Instagram } : null,
  ].filter((link) => link !== null);
  return (
    <main className={styles.profilePage}>
      <section className={styles.profileShell} aria-labelledby="member-name">
        <aside className={styles.profileSidebar}>
          <AvatarPreview src={avatarUrl} alt={member.name} initials={initials} />
          <span className={styles.committeeBadge}>{memberGroupLabel(member.structureItem.memberGroup)}</span>
          <div className={styles.profileSocials}>
            {links.map(({ label, url, icon: Icon }) => <a key={label} href={url} target="_blank" rel="noopener noreferrer" aria-label={label} title={label}><Icon size={23} aria-hidden="true" /></a>)}
          </div>
        </aside>
        <div className={styles.profileContent} dir="auto">
          <h1 id="member-name" dir="auto">{member.name}</h1>
          <p className={styles.profileRole} dir="auto">{title}</p>
          <p className={styles.biography} dir="auto">{member.profileBio?.trim() || "لم تتم إضافة نبذة شخصية بعد."}</p>
          {member.profileSkills.length > 0 && <ul className={styles.profileSkills} aria-label="المهارات">{member.profileSkills.map((skill) => <li key={skill}>{skill}</li>)}</ul>}
        </div>
      </section>
      <div className={styles.profileFooter}>
        <Link href="/members" className={styles.returnLink}><ArrowLeft size={21} aria-hidden="true" />Back to Members</Link>
      </div>
    </main>
  );
}
