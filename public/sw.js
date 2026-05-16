// No-op service worker. Exists ONLY so Chrome considers the site
// installable and fires the `beforeinstallprompt` event, which the
// in-app InstallAppHint listens for. This worker intentionally:
//   - caches nothing
//   - intercepts no fetches (no `fetch` handler -> requests go to network)
//   - serves no offline content
// As a result it cannot serve stale content, which is what the old
// caching SW was apparently disabled for. If a future requirement
// needs real caching, do it in a separate worker with explicit
// versioning and revisit the disable history first.
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
