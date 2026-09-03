
import webpush from "web-push";

import { prisma } from "@/lib/prisma";

type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag?: string;
};

type WebPushError = {
  statusCode?: number;
};

const publicKey =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

const privateKey =
  process.env.VAPID_PRIVATE_KEY;

const subject =
  process.env.VAPID_SUBJECT;

const pushConfigured =
  Boolean(
    publicKey &&
    privateKey &&
    subject,
  );

if (
  publicKey &&
  privateKey &&
  subject
) {
  webpush.setVapidDetails(
    subject,
    publicKey,
    privateKey,
  );
}

export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload,
) {
  if (
    !pushConfigured ||
    !userIds.length
  ) {
    return;
  }

  const uniqueUserIds =
    [...new Set(userIds)];

  const subscriptions =
    await prisma.pushSubscription.findMany({
      where: {
        userId: {
          in: uniqueUserIds,
        },
      },

      select: {
        endpoint: true,
        p256dh: true,
        auth: true,
      },
    });

  if (!subscriptions.length) {
    return;
  }

  const expiredEndpoints: string[] = [];

  await Promise.all(
    subscriptions.map(
      async (subscription) => {
        try {
          await webpush.sendNotification(
            {
              endpoint:
                subscription.endpoint,

              keys: {
                p256dh:
                  subscription.p256dh,

                auth:
                  subscription.auth,
              },
            },

            JSON.stringify({
              title:
                payload.title,

              body:
                payload.body,

              url:
                payload.url,

              tag:
                payload.tag,

              icon:
                "/images/club-logo.png",

              badge:
                "/images/club-logo.png",
            }),
          );
        } catch (error) {
          const statusCode =
            (
              error as WebPushError
            ).statusCode;

          /*
           * الاشتراك انتهى أو المتصفح
           * ألغاه، فنحذفه من DB.
           */
          if (
            statusCode === 404 ||
            statusCode === 410
          ) {
            expiredEndpoints.push(
              subscription.endpoint,
            );

            return;
          }

          console.error(
            "Push notification failed:",
            error,
          );
        }
      },
    ),
  );

  if (expiredEndpoints.length) {
    await prisma.pushSubscription.deleteMany({
      where: {
        endpoint: {
          in: expiredEndpoints,
        },
      },
    });
  }
}