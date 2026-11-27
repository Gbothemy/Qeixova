self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = { body: event.data?.text() || "" }; }
  const title = typeof payload.title === "string" ? payload.title : "Qeixova";
  const options = {
    body: typeof payload.body === "string" ? payload.body : "You have a new update.",
    icon: "/qeixova-icon.png",
    badge: "/icon-notifications.svg",
    tag: typeof payload.tag === "string" ? payload.tag : "qeixova-notification",
    data: { url: typeof payload.url === "string" ? payload.url : "/messages" },
    renotify: true,
  };
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    const appIsFocused = clients.some((client) => client.focused && client.visibilityState === "visible");
    if (appIsFocused) return undefined;
    return self.registration.showNotification(title, options);
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destination = new URL(event.notification.data?.url || "/messages", self.location.origin);
  const target = destination.origin === self.location.origin ? destination.href : new URL("/messages", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
    const existing = clients.find((client) => "focus" in client);
    if (existing) {
      if ("navigate" in existing) await existing.navigate(target);
      return existing.focus();
    }
    return self.clients.openWindow(target);
  }));
});
