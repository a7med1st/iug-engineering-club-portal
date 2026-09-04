import {
  NotificationType,
  Prisma,
} from "@prisma/client";
import {
  NextResponse,
} from "next/server";

import {
  authorizeAuthenticatedApi,
} from "@/lib/api-auth";
import {
  privateNoStoreJson,
} from "@/lib/private-response";
import { prisma } from "@/lib/prisma";
import {
  rejectCrossOriginRequest,
} from "@/lib/request-security";

export const dynamic =
  "force-dynamic";

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;

function parseLimit(
  request: Request,
) {
  const url =
    new URL(request.url);

  const raw =
    Number(
      url.searchParams.get(
        "limit",
      ),
    );

  if (
    !Number.isFinite(raw) ||
    raw <= 0
  ) {
    return DEFAULT_LIMIT;
  }

  return Math.min(
    Math.floor(raw),
    MAX_LIMIT,
  );
}

export async function GET(
  request: Request,
) {
  const auth =
    await authorizeAuthenticatedApi();

  if (!auth.authorized) {
    return auth.response;
  }

  const limit =
    parseLimit(request);

  const url =
    new URL(request.url);

  const isChatChannel =
    url.searchParams.get(
      "channel",
    ) === "chat";

  const before =
    url.searchParams
      .get("before")
      ?.trim() ?? "";

  const typeFilter:
    Prisma.NotificationWhereInput =
    isChatChannel
      ? {
          type:
            NotificationType.CHAT_MESSAGE,
        }
      : {
          type: {
            not:
              NotificationType.CHAT_MESSAGE,
          },
        };

  let cursorFilter:
    Prisma.NotificationWhereInput =
      {};

  if (before) {
    const cursorNotification =
      await prisma.notification.findFirst({
        where: {
          id: before,
          userId:
            auth.user.id,

          ...typeFilter,
        },

        select: {
          id: true,
          createdAt: true,
        },
      });

    if (!cursorNotification) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "INVALID_CURSOR",
        },
        {
          status: 400,
        },
      );
    }

    cursorFilter = {
      OR: [
        {
          createdAt: {
            lt:
              cursorNotification
                .createdAt,
          },
        },
        {
          createdAt:
            cursorNotification
              .createdAt,

          id: {
            lt:
              cursorNotification.id,
          },
        },
      ],
    };
  }

  const [
    rawItems,
    unreadCount,
  ] =
    await prisma.$transaction([
      prisma.notification.findMany({
        where: {
          userId:
            auth.user.id,

          ...typeFilter,
          ...cursorFilter,
        },

        orderBy: [
          {
            createdAt:
              "desc",
          },
          {
            id: "desc",
          },
        ],

        take:
          limit + 1,

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
          userId:
            auth.user.id,

          readAt: null,

          ...typeFilter,
        },
      }),
    ]);

  const hasMore =
    rawItems.length >
    limit;

  const items =
    rawItems.slice(
      0,
      limit,
    );

  return privateNoStoreJson({
    ok: true,
    unreadCount,
    hasMore,

    nextCursor:
      hasMore
        ? items.at(-1)?.id ??
          null
        : null,

    items: items.map(
      (item) => ({
        ...item,

        readAt:
          item.readAt
            ?.toISOString() ??
          null,

        createdAt:
          item.createdAt
            .toISOString(),
      }),
    ),
  });
}

export async function POST(
  request: Request,
) {
  const crossOriginResponse =
    rejectCrossOriginRequest(
      request,
    );

  if (crossOriginResponse) {
    return crossOriginResponse;
  }

  const auth =
    await authorizeAuthenticatedApi();

  if (!auth.authorized) {
    return auth.response;
  }

  let payload:
    | {
        id?: string;
        all?: boolean;
      }
    | null = null;

  try {
    payload =
      await request.json();
  } catch {
    payload = null;
  }

  const now =
    new Date();

  /*
   * This POST belongs to the general notifications UI.
   * CHAT_MESSAGE is marked read by opening its conversation.
   */
  if (payload?.all) {
    await prisma.notification.updateMany({
      where: {
        userId:
          auth.user.id,

        readAt: null,

        type: {
          not:
            NotificationType.CHAT_MESSAGE,
        },
      },

      data: {
        readAt: now,
      },
    });
  } else if (
    payload?.id
  ) {
    await prisma.notification.updateMany({
      where: {
        id:
          payload.id,

        userId:
          auth.user.id,

        readAt: null,

        type: {
          not:
            NotificationType.CHAT_MESSAGE,
        },
      },

      data: {
        readAt: now,
      },
    });
  } else {
    return NextResponse.json(
      {
        ok: false,
        error:
          "INVALID_REQUEST",
      },
      {
        status: 400,
      },
    );
  }

  const unreadCount =
    await prisma.notification.count({
      where: {
        userId:
          auth.user.id,

        readAt: null,

        type: {
          not:
            NotificationType.CHAT_MESSAGE,
        },
      },
    });

  return privateNoStoreJson({
    ok: true,
    unreadCount,
  });
}
