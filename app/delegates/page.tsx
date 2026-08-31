import Link from "next/link";
import {
  BadgeCheck,
  Crown,
  Network,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";

import { prisma } from "@/lib/prisma";

import styles from "./structure.module.css";

export const dynamic = "force-dynamic";

async function getStructureItems() {
  return prisma.clubStructureItem.findMany({
    include: {
      department: {
        select: {
          nameAr: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: [
      { level: "asc" },
      { sortOrder: "asc" },
      { createdAt: "asc" },
    ],
  });
}

type StructureItem = Awaited<ReturnType<typeof getStructureItems>>[number];

function getNodeTone(title: string, isRoot: boolean) {
  if (isRoot || title.includes("رئيس النادي")) {
    return "root";
  }

  if (title.includes("نائب")) {
    return "vice";
  }

  if (title.includes("علاقات")) {
    return "relations";
  }

  if (title.includes("مندوب")) {
    return "delegate";
  }

  return "member";
}

function RoleIcon({
  title,
  isRoot,
}: {
  title: string;
  isRoot: boolean;
}) {
  if (isRoot || title.includes("رئيس النادي")) {
    return <Crown aria-hidden="true" />;
  }

  if (title.includes("نائب")) {
    return <ShieldCheck aria-hidden="true" />;
  }

  if (title.includes("علاقات")) {
    return <BadgeCheck aria-hidden="true" />;
  }

  if (title.includes("مندوب")) {
    return <UsersRound aria-hidden="true" />;
  }

  return <UserRound aria-hidden="true" />;
}

function PersonNodeCard({
  item,
  isRoot,
}: {
  item: StructureItem;
  isRoot: boolean;
}) {
  const displayName = item.user?.name ?? item.name;
  const departmentName = item.department?.nameAr ?? "النادي الهندسي";
  const tone = getNodeTone(item.title, isRoot);

  const content = (
    <>
      <span className={styles.nodeGlow} aria-hidden="true" />

      <span className={styles.avatarBox}>
        <RoleIcon title={item.title} isRoot={isRoot} />
      </span>

      <span className={styles.nodeContent}>
        <span className={styles.roleBadge}>{item.title}</span>
        <strong>{displayName}</strong>
        <small>{departmentName}</small>
      </span>

      {item.user?.id ? (
        <span className={styles.profileHint} aria-hidden="true">
          <span>عرض الملف</span>
          <span>←</span>
        </span>
      ) : null}
    </>
  );

  if (item.user?.id) {
    return (
      <Link
        href={`/members/${item.user.id}`}
        className={`${styles.nodeCard} ${isRoot ? styles.rootCard : ""}`}
        data-tone={tone}
        aria-label={`عرض ملف ${displayName}`}
      >
        {content}
      </Link>
    );
  }

  return (
    <div
      className={`${styles.nodeCard} ${isRoot ? styles.rootCard : ""}`}
      data-tone={tone}
    >
      {content}
    </div>
  );
}

function StructureNode({
  item,
  childrenByParent,
  isRoot = false,
}: {
  item: StructureItem;
  childrenByParent: Map<string | null, StructureItem[]>;
  isRoot?: boolean;
}) {
  const children = childrenByParent.get(item.id) ?? [];

  return (
    <li className={`${styles.branch} ${isRoot ? styles.rootBranch : ""}`}>
      <PersonNodeCard item={item} isRoot={isRoot} />

      {children.length ? (
        <ul className={styles.children}>
          {children.map((child) => (
            <StructureNode
              key={child.id}
              item={child}
              childrenByParent={childrenByParent}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export default async function DelegatesPage() {
  const items = await getStructureItems();

  const childrenByParent = new Map<string | null, StructureItem[]>();
  const itemIds = new Set(items.map((item) => item.id));

  for (const item of items) {
    // Treat an orphaned row as a root so a stale parent reference never makes
    // an otherwise valid structure member disappear from the public tree.
    const key = item.parentId && itemIds.has(item.parentId) ? item.parentId : null;
    const current = childrenByParent.get(key) ?? [];
    current.push(item);
    childrenByParent.set(key, current);
  }

  const roots = childrenByParent.get(null) ?? [];

  return (
    <main className={styles.page} dir="rtl">
      <section className={styles.hero}>
        <span className={styles.heroGrid} aria-hidden="true" />
        <span className={styles.heroOrbOne} aria-hidden="true" />
        <span className={styles.heroOrbTwo} aria-hidden="true" />

        <div className={styles.heroCopy} data-reveal="up">
          <div className={styles.heroIcon}>
            <Network aria-hidden="true" />
          </div>

          <div>
            <h1>الهيكلية التنظيمية</h1>
            <p>
              تعرّف على رئيس النادي ونائبه والعلاقات العامة ومندوبي الأقسام
              وأعضاء النادي، واضغط على أي عضو لعرض ملفه الشخصي.
            </p>
          </div>
        </div>

        <div className={styles.heroVisual} aria-hidden="true">
          <span className={styles.heroVisualNode}>
            <Crown />
          </span>
          <span className={styles.heroVisualLine} />
          <span className={styles.heroVisualRow}>
            <span><ShieldCheck /></span>
            <span><UsersRound /></span>
            <span><UserRound /></span>
          </span>
        </div>
      </section>

      <section className={styles.treePanel} data-reveal="up">
        <div className={styles.panelGlow} aria-hidden="true" />
        <div className={styles.panelGrid} aria-hidden="true" />

        {roots.length ? (
          <div className={styles.treeViewport}>
            <div className={styles.treeCanvas}>
              <ul className={styles.tree}>
                {roots.map((root) => (
                  <StructureNode
                    key={root.id}
                    item={root}
                    childrenByParent={childrenByParent}
                    isRoot
                  />
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className={styles.emptyState}>
            <span>
              <Network aria-hidden="true" />
            </span>
            <strong>الهيكلية غير متاحة حاليًا</strong>
            <p>ستظهر أسماء أعضاء الهيكلية هنا بعد إضافتهم من لوحة الإدارة.</p>
          </div>
        )}
      </section>
    </main>
  );
}
