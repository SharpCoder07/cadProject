/* Cadgram service worker: shows browser push notifications and opens the right page when one is clicked.
   It doesn't cache pages or files. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Cadgram";
  const options = {
    body: data.body || "",
    icon: "/brand/cadgram-icon-512.png",
    badge: "/brand/cadgram-icon-512.png",
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    data: { href: data.href || "/" },
  };
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      // Open tabs refresh their bell straight away.
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((tabs) => tabs.forEach((t) => t.postMessage({ type: "cg-notification" }))),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = (event.notification.data && event.notification.data.href) || "/";
  const target = new URL(href, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((tabs) => {
      for (const tab of tabs) {
        if (new URL(tab.url).origin === self.location.origin && "focus" in tab) {
          return tab.focus().then((t) => (t && "navigate" in t ? t.navigate(target) : self.clients.openWindow(target)));
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
