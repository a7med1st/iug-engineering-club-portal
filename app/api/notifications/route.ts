import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;

function parseLimit(request: Request) {
  const url = new URL(request.url);
  const raw = Number(url.searchParams.get("limit"));

  if (!Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.min(Math.floor(raw), MAX_LIMIT);
}

export async function GET(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { ok: false },
      { status: 401 },
    );
  }

  const limit = parseLimit(request);

  const [items, unreadCount] = await prisma.$transaction([
    prisma.notification.findMany({
      where: {
        userId: session.sub,
      },

      orderBy: {
        createdAt: "desc",
      },

      take: limit,

      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        href: true,
        readAt: true,
        createdAt: true,
      },
    }),

    prisma.notification.count({
      where: {
        userId: session.sub,
        readAt: null,
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    unreadCount,
    items: items.map((item) => ({
      ...item,
      readAt: item.readAt?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { ok: false },
      { status: 401 },
    );
  }

  let payload:
    | {
        id?: string;
        all?: boolean;
      }
    | null = null;

  try {
    payload = await request.json();
  } catch {
    payload = null;
  }

  const now = new Date();

  if (payload?.all) {
    await prisma.notification.updateMany({
      where: {
        userId: session.sub,
        readAt: null,
      },

      data: {
        readAt: now,
      },
    });
  } else if (payload?.id) {
    await prisma.notification.updateMany({
      where: {
        id: payload.id,
        userId: session.sub,
        readAt: null,
      },

      data: {
        readAt: now,
      },
    });
  } else {
    return NextResponse.json(
      {
        ok: false,
        error: "INVALID_REQUEST",
      },
      {
        status: 400,
      },
    );
  }

  const unreadCount = await prisma.notification.count({
    where: {
      userId: session.sub,
      readAt: null,
    },
  });

  return NextResponse.json({
    ok: true,
    unreadCount,
  });
}
