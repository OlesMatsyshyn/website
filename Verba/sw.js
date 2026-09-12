const CACHE_VERSION = "verba-v24";
const PACKAGE_ASSET_CACHE = "verba-package-assets-v2";
const CORE_ASSETS = [
  "./",
  "./manifest.webmanifest",
  "./icons/verba.svg",
  "./icons/verba-192.png",
  "./icons/verba-512.png",
  "./packages/catalog.json",
  "./_next/static/chunks/36aahpx4gozqd.css",
  "./_next/static/chunks/1q3jxv4k22mzw.js",
  "./_next/static/chunks/2m7g1n7woz_7n.js",
  "./_next/static/chunks/1qxpuizk7zz82.js",
  "./_next/static/chunks/turbopack-2b2m7ur_qx03m.js",
  "./_next/static/chunks/0x662v0g_zpv0.js",
  "./_next/static/chunks/3h9tt8ho3re8b.js",
  "./_next/static/chunks/0cz1d0mv5g_q7.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(CORE_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => (key.startsWith("verba-") || key.startsWith("verba-package-assets-")) && key !== CACHE_VERSION && key !== PACKAGE_ASSET_CACHE)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);
  const scopeUrl = new URL(self.registration.scope);

  if (requestUrl.origin !== scopeUrl.origin || !requestUrl.pathname.startsWith(scopeUrl.pathname)) {
    return;
  }

  if (event.request.method !== "GET") {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put("./", copy));
          }
          return response;
        })
        .catch(() =>
          caches.match(event.request).then((cached) => cached || caches.match("./") || new Response("Vérba is unavailable offline.", { status: 503 })),
        ),
    );
    return;
  }

  if (requestUrl.pathname.includes("/packages/")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() =>
          caches.match(event.request).then((cached) => {
            if (cached) return cached;
            throw new Error("Vérba package unavailable offline.");
          }),
        ),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => {
          if (event.request.mode === "navigate") {
            return caches.match("./");
          }
          throw new Error("Vérba asset unavailable offline.");
        });
    }),
  );
});
