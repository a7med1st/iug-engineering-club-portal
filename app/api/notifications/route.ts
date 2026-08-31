import { NextResponse } from "next/server";

import { authorizeAuthenticatedApi } from "@/lib/api-auth";
import { privateNoStoreJson } from "@/lib/private-response";
import { prisma } from "@/lib/prisma";
import { rejectCrossOriginRequest } from "@/lib/request-security";

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
  const auth = await authorizeAuthenticatedApi();
  if (!auth.authorized) return auth.response;

  const limit = parseLimit(request);

  const [items, unreadCount] = await prisma.$transaction([
    prisma.notification.findMany({
      where: {
        userId: auth.user.id,
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
        userId: auth.user.id,
        readAt: null,
      },
    }),
  ]);

  return privateNoStoreJson({
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
  const crossOriginResponse = rejectCrossOriginRequest(request);

  if (crossOriginResponse) {
    return crossOriginResponse;
  }

  const auth = await authorizeAuthenticatedApi();
  if (!auth.authorized) return auth.response;

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
        userId: auth.user.id,
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
        userId: auth.user.id,
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
      userId: auth.user.id,
      readAt: null,
    },
  });

  return privateNoStoreJson({
    ok: true,
    unreadCount,
  });
}
