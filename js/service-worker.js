const CACHE_PREFIX = "checkin-cache-";
const CACHE_VERSION = '0.1.5';
const CACHE_NAME = `${CACHE_PREFIX}-${CACHE_VERSION}`;

const APP_SHELL = [
  "/",
  "/index.html",
  "/js/checkin-activity.js",
  "/js/checkin-choose-place.js",
  "/js/checkin-element.js",
  "/js/checkin-home.js",
  "/js/checkin-inbox.js",
  "/js/checkin-login.js",
  "/js/checkin-save.js",
  "https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.15.0/cdn/themes/light.css",
  "https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.15.0/cdn/shoelace.js",
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap",
  'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js',
  'https://cdn.jsdelivr.net/npm/oauth4webapi@3/+esm',
  'https://cdn.jsdelivr.net/npm/dompurify@3.2.3/+esm'
];

// Install: pre-cache app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for app shell, network fallback
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET
  if (request.method !== "GET") return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Optionally cache new GET requests
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      });
    })
  );
});
