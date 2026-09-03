function urlBase64ToUint8Array(
  base64String: string,
) {
  const padding =
    "=".repeat(
      (4 - (base64String.length % 4)) % 4,
    );

  const base64 = (
    base64String + padding
  )
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData =
    window.atob(base64);

  return Uint8Array.from(
    [...rawData].map(
      (character) =>
        character.charCodeAt(0),
    ),
  );
}

export async function ensurePushSubscription() {
  try {
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      return false;
    }

    const publicKey =
      process.env
        .NEXT_PUBLIC_VAPID_PUBLIC_KEY;

    if (!publicKey) {
      console.error(
        "NEXT_PUBLIC_VAPID_PUBLIC_KEY is missing",
      );

      return false;
    }

    /*
     * مهم:
     * طلب الصلاحية يكون مباشرة
     * نتيجة ضغط المستخدم.
     */
    let permission =
      Notification.permission;

    if (permission === "default") {
      permission =
        await Notification.requestPermission();
    }

    if (permission !== "granted") {
      return false;
    }

    const registration =
      await navigator.serviceWorker.register(
        "/sw.js",
        {
          scope: "/",
        },
      );

    await navigator.serviceWorker.ready;

    let subscription =
      await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription =
        await registration.pushManager.subscribe({
          userVisibleOnly: true,

          applicationServerKey:
            urlBase64ToUint8Array(
              publicKey,
            ),
        });
    }

    const json =
      subscription.toJSON();

    const p256dh =
      json.keys?.p256dh;

    const auth =
      json.keys?.auth;

    if (
      !subscription.endpoint ||
      !p256dh ||
      !auth
    ) {
      return false;
    }

    const response =
      await fetch(
        "/api/push/subscribe",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            endpoint:
              subscription.endpoint,

            keys: {
              p256dh,
              auth,
            },
          }),
        },
      );

    return response.ok;
  } catch (error) {
    console.error(
      "Push subscription failed:",
      error,
    );

    return false;
  }
}