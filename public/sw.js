self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data
      ? event.data.json()
      : {};
  } catch {
    payload = {
      title: "النادي الهندسي للطلاب",
      body: event.data?.text() ?? "لديك إشعار جديد",
    };
  }

  const title =
    payload.title ||
    "النادي الهندسي للطلاب";

  const options = {
    body:
      payload.body ||
      "لديك إشعار جديد",

    icon:
      payload.icon ||
      "/images/club-logo.png",

    badge:
      payload.badge ||
      "/images/club-logo.png",

    tag:
      payload.tag ||
      `engineering-club-${Date.now()}`,

    data: {
      url:
        payload.url ||
        payload.href ||
        "/",
    },

    dir: "rtl",
    lang: "ar",

    renotify: true,

    vibrate: [180, 80, 180],
  };

  event.waitUntil(
    self.registration.showNotification(
      title,
      options,
    ),
  );
});


self.addEventListener(
  "notificationclick",
  (event) => {
    event.notification.close();

    const targetUrl =
      event.notification.data?.url ||
      "/";

    event.waitUntil(
      clients
        .matchAll({
          type: "window",
          includeUncontrolled: true,
        })
        .then(async (clientList) => {
          const absoluteUrl =
            new URL(
              targetUrl,
              self.location.origin,
            ).href;

          for (const client of clientList) {
            if (
              "focus" in client &&
              client.url.startsWith(
                self.location.origin,
              )
            ) {
              try {
                await client.navigate(
                  absoluteUrl,
                );
              } catch {}

              return client.focus();
            }
          }

          if (clients.openWindow) {
            return clients.openWindow(
              absoluteUrl,
            );
          }
        }),
    );
  },
);