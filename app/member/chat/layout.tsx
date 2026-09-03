import type { ReactNode } from "react";
import {
  PERMISSIONS,
  requirePermission,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

import ChatSidebar from "@/components/member/ChatSidebar";

import styles from "./chat.module.css";

export const dynamic = "force-dynamic";

export default async function ChatLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { user } = await requirePermission(
    PERMISSIONS.MEMBER_DASHBOARD,
  );

  const [memberships, availableUsers] = await Promise.all([
    prisma.chatParticipant.findMany({
      where: {
        userId: user.id,
        conversation: {
          type: "DIRECT",
        },
      },
      include: {
        conversation: {
          include: {
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    role: true,
                    avatarStoredName: true,
                    avatarUpdatedAt: true,
                    department: { select: { nameAr: true } },
                    structureItem: { select: { title: true } },
                  },
                },
              },
            },
            messages: {
              take: 1,
              orderBy: { createdAt: "desc" },
              select: {
                id: true,
                body: true,
                createdAt: true,
                senderId: true,
              },
            },
          },
        },
      },
    }),

    prisma.user.findMany({
      where: {
        id: { not: user.id },
        role: { in: ["MEMBER", "ADMIN"] },
      },
      select: {
        id: true,
        name: true,
        role: true,
        department: { select: { nameAr: true } },
        structureItem: { select: { title: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const rows = await Promise.all(
    memberships.map(async (membership) => {
      const conversation = membership.conversation;

      const partner =
        conversation.participants.find(
          (item) => item.userId !== user.id,
        )?.user ?? null;

      const readAfter =
        membership.lastReadAt ?? membership.joinedAt;

      const unreadCount = await prisma.chatMessage.count({
        where: {
          conversationId: conversation.id,
          senderId: { not: user.id },
          createdAt: { gt: readAfter },
        },
      });

      const lastMessage = conversation.messages[0] ?? null;

      return {
        id: conversation.id,
        partner: partner
          ? {
            id: partner.id,
            name: partner.name,
            role: partner.role,
            title:
              partner.structureItem?.title ??
              (partner.role === "ADMIN"
                ? "إدارة النادي"
                : "عضو"),
            department:
              partner.department?.nameAr ?? null,
            hasAvatar: Boolean(partner.avatarStoredName),
            avatarVersion:
              partner.avatarUpdatedAt?.getTime() ?? 0,
          }
          : null,
        lastMessage: lastMessage
          ? {
            body: lastMessage.body,
            createdAt:
              lastMessage.createdAt.toISOString(),
            mine: lastMessage.senderId === user.id,
          }
          : null,
        unreadCount,
        sortTime:
          conversation.lastMessageAt?.getTime() ??
          conversation.createdAt.getTime(),
      };
    }),
  );

  rows.sort((a, b) => b.sortTime - a.sortTime);

  return (
    <main className={styles.page}>
        <section className={styles.shell}>
          <ChatSidebar
            conversations={rows}
            availableUsers={availableUsers.map((item) => ({
              id: item.id,
              name: item.name,
              role: item.role,
              title:
                item.structureItem?.title ??
                (item.role === "ADMIN"
                  ? "إدارة النادي"
                  : "عضو"),
              department: item.department?.nameAr ?? null,
            }))}
          />

          <div
            className={styles.content}
            data-page-transition-content
          >
            {children}
          </div>
        </section>
    </main>
  );
}