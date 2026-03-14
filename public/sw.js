const STATIC_CACHE = "dp-static-v1";
const RUNTIME_CACHE = "dp-runtime-v1";
const MEDIA_CACHE = "dp-media-v1";
const API_CACHE = "dp-api-v1";

const APP_SHELL_URLS = [
  "/",
  "/journey",
  "/favorites",
  "/practice",
  "/my-library",
  "/settings",
  "/favicon/favicon-32x32.png",
  "/favicon/apple-touch-icon.png",
  "/sounds/practice-correct.wav",
  "/sounds/practice-wrong.wav",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL_URLS)).catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => ![STATIC_CACHE, RUNTIME_CACHE, MEDIA_CACHE, API_CACHE].includes(key))
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, RUNTIME_CACHE));
    return;
  }

  if (!isSameOrigin) {
    if (/\.(mp3|m4a|wav|ogg|jpg|jpeg|png|webp|avif)$/i.test(url.pathname)) {
      event.respondWith(cacheFirst(request, MEDIA_CACHE));
    }
    return;
  }

  if (
    url.pathname.startsWith("/api/favorites") ||
    url.pathname.startsWith("/api/library") ||
    url.pathname.startsWith("/api/journey/practice") ||
    url.pathname.startsWith("/api/user-stories") ||
    url.pathname.startsWith("/api/standalone-story-audio")
  ) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  if (/\.(mp3|m4a|wav|ogg|jpg|jpeg|png|webp|avif|svg|ico|css|js)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(request, MEDIA_CACHE));
    return;
  }

  event.respondWith(networkFirst(request, RUNTIME_CACHE));
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "CACHE_URLS" || !Array.isArray(data.urls)) return;

  const urls = data.urls.filter((value) => typeof value === "string" && value.trim().length > 0);
  event.waitUntil(
    caches.open(RUNTIME_CACHE).then(async (cache) => {
      for (const raw of urls) {
        try {
          const url = new URL(raw, self.location.origin).toString();
          const request = new Request(url, { credentials: "same-origin" });
          const response = await fetch(request);
          if (response && response.ok) {
            await cache.put(request, response.clone());
          }
        } catch {
          // ignore individual cache failures
        }
      }
    })
  );
});
