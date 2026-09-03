import { authorizeAuthenticatedApi } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { privateNoStoreJson } from "@/lib/private-response";
import { rejectCrossOriginRequest } from "@/lib/request-security";

export const dynamic = "force-dynamic";

type PushSubscriptionPayload = {
  endpoint?: string;

  keys?: {
    p256dh?: string;
    auth?: string;
  };
};

export async function POST(
  request: Request,
) {
  const crossOriginResponse =
    rejectCrossOriginRequest(request);

  if (crossOriginResponse) {
    return crossOriginResponse;
  }

  const auth =
    await authorizeAuthenticatedApi();

  if (!auth.authorized) {
    return auth.response;
  }

  let payload:
    | PushSubscriptionPayload
    | null = null;

  try {
    payload =
      (await request.json()) as PushSubscriptionPayload;
  } catch {
    payload = null;
  }

  const endpoint =
    payload?.endpoint?.trim();

  const p256dh =
    payload?.keys?.p256dh?.trim();

  const authKey =
    payload?.keys?.auth?.trim();

  if (
    !endpoint ||
    !p256dh ||
    !authKey
  ) {
    return privateNoStoreJson(
      {
        ok: false,
        error:
          "INVALID_PUSH_SUBSCRIPTION",
      },
      {
        status: 400,
      },
    );
  }

  /*
   * endpoint فريد لكل PushSubscription.
   *
   * لو نفس المتصفح كان مسجل سابقًا
   * نحدث الاشتراك بدل إنشاء نسخة ثانية.
   */
  await prisma.pushSubscription.upsert({
    where: {
      endpoint,
    },

    create: {
      userId: auth.user.id,
      endpoint,
      p256dh,
      auth: authKey,

      userAgent:
        request.headers.get(
          "user-agent",
        ),
    },

    update: {
      /*
       * مهم لو شخص آخر سجل دخول
       * من نفس المتصفح.
       */
      userId: auth.user.id,

      p256dh,
      auth: authKey,

      userAgent:
        request.headers.get(
          "user-agent",
        ),
    },
  });

  return privateNoStoreJson({
    ok: true,
  });
}

/*
 * حذف الاشتراك عند تعطيل
 * المستخدم للإشعارات.
 */
export async function DELETE(
  request: Request,
) {
  const crossOriginResponse =
    rejectCrossOriginRequest(request);

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
        endpoint?: string;
      }
    | null = null;

  try {
    payload =
      (await request.json()) as {
        endpoint?: string;
      };
  } catch {
    payload = null;
  }

  const endpoint =
    payload?.endpoint?.trim();

  if (!endpoint) {
    return privateNoStoreJson(
      {
        ok: false,
        error: "INVALID_ENDPOINT",
      },
      {
        status: 400,
      },
    );
  }

  await prisma.pushSubscription.deleteMany({
    where: {
      endpoint,
      userId: auth.user.id,
    },
  });

  return privateNoStoreJson({
    ok: true,
  });
}