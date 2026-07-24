// Register event listener for the 'push' event.
self.addEventListener("push", function (event) {
  if (!(self.Notification && self.Notification.permission === "granted")) {
    return;
  }

  console.log("SW: Push message received");
  const dataStr = event.data ? event.data.text() : "";
  let data = {};
  try {
    data = dataStr ? JSON.parse(dataStr) : {};
  } catch (error) {
    console.error("SW: Failed to parse push payload", error);
  }

  const title = data.title || "Springvale Solenis";
  const message =
    data.message || "A calculation is waiting for approval.";
  const icon = data.icon || "/icon-192.png";
  const url = data.url || "/approvals";

  event.waitUntil(
    self.registration.showNotification(title, {
      body: message,
      tag: data.tag || `solenis-${new Date().toISOString()}`,
      icon,
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", function (event) {
  console.log("SW: Notification clicked");
  const url = event.notification.data?.url || "/approvals";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientsArr) => {
        let client = null;

        for (let i = 0; i < clientsArr.length; i++) {
          const item = clientsArr[i];
          if (item.url) {
            client = item;
            break;
          }
        }

        if (client && "navigate" in client) {
          client.focus();
          event.notification.close();
          return client.navigate(url);
        }

        event.notification.close();
        return self.clients.openWindow(url);
      }),
  );
});

self.addEventListener("install", (event) => {
  console.log("SW: installed event");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("SW: activate event");
  event.waitUntil(self.clients.claim());
});
