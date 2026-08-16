import Link from "next/link";

import {
  Network,
  UserRound,
} from "lucide-react";

import { prisma } from "@/lib/prisma";

import styles from "./structure.module.css";

export const dynamic = "force-dynamic";

type StructureNode = {
  id: string;
  name: string;
  title: string;
  level: number;
  sortOrder: number;
  parentId: string | null;
  user: {
    id: string;
    name: string;
    avatarStoredName: string | null;
    avatarUpdatedAt: Date | null;
  } | null;
  department: {
    nameAr: string;
  } | null;
};

function StructureBranch({
  node,
  childrenMap,
}: {
  node: StructureNode;
  childrenMap: Map<
    string,
    StructureNode[]
  >;
}) {
  const children =
    childrenMap.get(node.id) ?? [];

  const card = (
    <article className={styles.nodeCard}>
      <div className={styles.avatar}>
        {node.user?.avatarStoredName ? (
          <img
            src={`/members/${node.user.id}/avatar?v=${node.user.avatarUpdatedAt?.getTime() ?? 0}`}
            alt=""
          />
        ) : (
          <UserRound size={23} />
        )}
      </div>

      <div>
        <span className={styles.title}>
          {node.title}
        </span>
        <strong>
          {node.user?.name ?? node.name}
        </strong>
        <small>
          {node.department?.nameAr ??
            "النادي الهندسي"}
        </small>
      </div>
    </article>
  );

  return (
    <li className={styles.branch}>
      {node.user ? (
        <Link
          href={`/members/${node.user.id}`}
          className={styles.nodeLink}
        >
          {card}
        </Link>
      ) : (
        card
      )}

      {children.length > 0 && (
        <ul className={styles.children}>
          {children.map((child) => (
            <StructureBranch
              key={child.id}
              node={child}
              childrenMap={childrenMap}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default async function DelegatesPage() {
  const items =
    await prisma.clubStructureItem.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarStoredName: true,
            avatarUpdatedAt: true,
          },
        },
        department: {
          select: {
            nameAr: true,
          },
        },
      },
      orderBy: [
        { level: "asc" },
        { sortOrder: "asc" },
        { createdAt: "asc" },
      ],
    });

  const nodes =
    items as StructureNode[];

  const idSet = new Set(
    nodes.map((item) => item.id),
  );

  const roots = nodes.filter(
    (item) =>
      !item.parentId ||
      !idSet.has(item.parentId),
  );

  const childrenMap = new Map<
    string,
    StructureNode[]
  >();

  for (const node of nodes) {
    if (!node.parentId) continue;

    const list =
      childrenMap.get(node.parentId) ?? [];

    list.push(node);

    list.sort(
      (a, b) =>
        a.sortOrder - b.sortOrder,
    );

    childrenMap.set(
      node.parentId,
      list,
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroIcon}>
          <Network size={30} />
        </div>

        <div>
          <span className={styles.eyebrow}>
            Engineering Club
          </span>
          <h1>الهيكلية التنظيمية</h1>
          <p>
            تعرف على رئيس النادي، نائبه، العلاقات العامة، مناديب الأقسام وأعضاء النادي. اضغط على أي عضو لعرض ملفه الشخصي.
          </p>
        </div>
      </section>

      {roots.length ? (
        <div className={styles.treeScroll}>
          <ul className={styles.tree}>
            {roots.map((root) => (
              <StructureBranch
                key={root.id}
                node={root}
                childrenMap={childrenMap}
              />
            ))}
          </ul>
        </div>
      ) : (
        <section className={styles.empty}>
          <Network size={34} />
          <h2>الهيكلية قيد التجهيز</h2>
          <p>
            ستظهر هنا شجرة أعضاء النادي بعد إضافتها من لوحة الإدارة.
          </p>
        </section>
      )}
    </main>
  );
}
