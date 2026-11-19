/* Box Office War — rebuilt. Cache-first service worker for offline play (PWA only; stripped in the APK). */
var CACHE = "bow2-rebuild-v7";
var ASSETS = [
  "./",
  "index.html",
  "boc-premium.css",
  "mobile-shell.css",
  "style.css",
  "data.js",
  "cast-banks.js",
  "box-office-sim-2-cast.js",
  "cast-bridge.js",
  "engine.js",
  "tv.js",
  "empire.js",
  "pr.js",
  "biz.js",
  "ott.js",
  "games.js",
  "library.js",
  "exhibition.js",
  "creative.js",
  "finance.js",
  "challenges.js",
  "i18n.js",
  "sound.js",
  "posters.js",
  "people.js",
  "media.js",
  "strategy.js",
  "meta.js",
  "tech.js",
  "events2.js",
  "bizdeal.js",
  "slots.js",
  "meta2.js",
  "crew.js",
  "mastery.js",
  "world.js",
  "licensing.js",
  "awards.js",
  "festivals.js",
  "social_viral.js",
  "stadium.js",
  "talent_agency.js",
  "cameo.js",
  "box-office-collection-engine.js",
  "opsuite.js",
  "liveops.js",
  "mktblitz.js",
  "consolehw.js",
  "rivals.js",
  "sequel.js",
  "craft.js",
  "mentor.js",
  "legacy.js",
  "window.js",
  "labor.js",
  "awardsplus.js",
  "help.js",
  "ui.js",
  "mobile-shell.js",
  "phone-ux.js",
  "manifest.webmanifest",
  "icon.svg",
  "icon-192.png",
  "icon-512.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }));
  self.skipWaiting();
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }));
  self.clients.claim();
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  e.respondWith(caches.match(e.request).then(function (hit) {
    if (hit) return hit;
    return fetch(e.request).then(function (resp) {
      var copy = resp.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      return resp;
    }).catch(function () { return caches.match("./"); });
  }));
});
