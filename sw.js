/* BOX OFFICE WAR — service worker: offline-first, but app-shell navigations go
   network-first so a fresh deploy is picked up on the next visit instead of
   serving a stale page from cache; everything else stays cache-first. */
"use strict";
const CACHE = "bow-v26-cache";
const ASSETS = [
  "./",
  "index.html",
  "style.css",
  "data.js",
  "engine.js",
  "i18n.js",
  "ui.js",
  "manifest.webmanifest",
  "icon.svg",
  "icon-192.png",
  "icon-512.png",
  "assets/opening-night.jpg"
];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  /* navigation = the app shell itself: network-first, cached copy as the
     offline fallback (and refreshed into the cache when the network wins) */
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request).then((res) => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put("index.html", clone));
        }
        return res;
      }).catch(() => caches.match("index.html").then((hit) => hit || caches.match("./")))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(e.request).then((res) => {
        if (res && res.ok && new URL(e.request.url).origin === location.origin) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      });
    }).catch(() => caches.match("index.html"))
  );
});
