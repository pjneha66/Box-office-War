/* BOX OFFICE WAR — service worker: offline-first, but app-shell navigations go
   network-first so a fresh deploy is picked up on the next visit instead of
   serving a stale page from cache; everything else stays cache-first. */
"use strict";
const CACHE = "bow-v93-cache";
const ASSETS = [
  "welcome.css",
  "command-deck.css",
  "assets/studio/department-furniture.png",
  "assets/studio/department-furniture.json",
  "assets/studio/screening-still.png",
  "assets/studio/people/0.png",
  "assets/studio/people/1.png",
  "assets/studio/people/10.png",
  "assets/studio/people/11.png",
  "assets/studio/people/12.png",
  "assets/studio/people/13.png",
  "assets/studio/people/14.png",
  "assets/studio/people/15.png",
  "assets/studio/people/16.png",
  "assets/studio/people/17.png",
  "assets/studio/people/18.png",
  "assets/studio/people/19.png",
  "assets/studio/people/2.png",
  "assets/studio/people/20.png",
  "assets/studio/people/21.png",
  "assets/studio/people/22.png",
  "assets/studio/people/23.png",
  "assets/studio/people/3.png",
  "assets/studio/people/4.png",
  "assets/studio/people/5.png",
  "assets/studio/people/6.png",
  "assets/studio/people/7.png",
  "assets/studio/people/8.png",
  "assets/studio/people/9.png",
  "assets/studio/people/manifest.json",
  "assets/studio/people/portraits.png",
  "assets/vendor/lpc-revised/NOTICE.md",
  "assets/vendor/lpc-revised/Characters-Credits.txt",
  "assets/vendor/lpc-revised/Characters-Clothing-Credits.txt",
  "assets/vendor/lpc-revised/Characters-Hair-Credits.txt",
  "assets/vendor/lpc-revised/README.md",

  "studio-agent-life.js",
  "assets/studio/story-furniture.png",
  "assets/studio/story-furniture.json",
  "assets/vendor/kenney-cars/delivery_SE-trim.png",
  "assets/vendor/kenney-cars/sedanSports_SE-trim.png",
  "assets/vendor/kenney-furniture/atlas.png",
  "assets/vendor/kenney-furniture/atlas.json",
  "assets/vendor/kenney-nature/tree_palmDetailedTall_SE-trim.png",
  "assets/vendor/kenney-nature/plant_bushDetailed_SE-trim.png",
  "./",
  "index.html",
  "design-tokens.css",
  "style.css",
  "ui-v33.css",
  "lot-gameplay.css",
  "data.js",
  "engine.js",
  "i18n.js",
  "ui.js",
  "bo-charts.js",
  "finance-tools.js",
  "challenge-leaderboard.js",
  "theater-chains.js",
  "dynamic-soundtrack.js",
  "dynasty-legacy.js",
  "bow-shorts.js",
  "talent-agency.js",
  "film-restoration.js",
  "festival-pr.js",
  "studio-facilities.js",
  "syndication-tv.js",
  "talent-contracts.js",
  "bond-market.js",
  "clash-analytics.js",
  "cinematic-universe.js",
  "location-scouting.js",
  "production-insurance.js",
  "awards-campaign.js",
  "board-targets.js",
  "fan-conventions.js",
  "test-screenings.js",
  "studio-espionage.js",
  "merch-licensing.js",
  "territory-licensing.js",
  "custom-sandbox.js",
  "v31-features.js",
  "film-locations-tax.js",
  "studio-operations-suite.js",
  "gamedev-console-hardware.js",
  "live-ops-coproduction.js",
  "hollywood-crises-pr.js",
  "demographics-audiences.js",
  "production-creativity-suite.js",
  "exhibition-plf-concessions.js",
  "marketing-blitz-engine.js",
  "studio-lot-engine.js",
  "studio-lot-2d.js",
  "studio-actors.js",
  "studio-departments.js",
  "lot-life.js",
  "lot-life.css",
  "lot-feel.js",
  "bow-motion.js",
  "bow-restyle.css",
  "box-office-sim-2-cast.js",
  "gamestudio-gdd-engine.js",
  "social-viral-network.js",
  "sports-stadium-deals.js",
  "kairo-theme-suite.js",
  "manifest.webmanifest",
  "icon.svg",
  "icon-192.png",
  "icon-512.png",
  "assets/opening-night.jpg",
  "assets/itch-ui/bars/BigBar_Base.png",
  "assets/itch-ui/bars/BigBar_Fill.png",
  "assets/itch-ui/buttons/BigBlueButton_Pressed.png",
  "assets/itch-ui/buttons/BigRedButton_Pressed.png",
  "assets/itch-ui/buttons/SmallBlueRoundButton_Pressed.png",
  "assets/itch-ui/buttons/SmallBlueSquareButton_Pressed.png",
  "assets/itch-ui/buttons/SmallBlueSquareButton_Regular.png",
  "assets/itch-ui/cursors/Cursor_01.png",
  "assets/itch-ui/cursors/Cursor_02.png",
  "assets/itch-ui/icons/Icon_01.png",
  "assets/itch-ui/icons/Icon_04.png",
  "assets/itch-ui/icons/Icon_05.png",
  "assets/itch-ui/icons/Icon_06.png",
  "assets/itch-ui/icons/Icon_07.png",
  "assets/itch-ui/icons/Icon_09.png",
  "assets/itch-ui/icons/Icon_10.png",
  "assets/itch-ui/icons/Icon_12.png",
  "assets/itch-ui/papers/SpecialPaper.png",
  "assets/itch-ui/ribbons/SmallRibbons.png",
  "assets/itch-ui/wood/wood_tile.png",

  "assets/studio/actors.json",
  "assets/studio/soundstage.png",
  "assets/studio/virtual_led.png",
  "assets/studio/post_suite.png",
  "assets/studio/writers_bungalow.png",
  "assets/studio/studio_gate.png",
  "assets/studio/backlot.png",
  "assets/studio/cinema_theater.png",
  "assets/studio/executive.png",

  "assets/studio/audience.png",
  "assets/studio/cameraman.png",
  "assets/studio/director.png",
  "assets/studio/editor.png",
  "assets/studio/producer.png",
  "assets/studio/star_actor.png",
  "assets/studio/writer.png",

  // Lot scenes and sprites must be available on first offline department visit.
  "assets/2d/backlot.png",
  "assets/2d/char_audience.png",
  "assets/2d/char_cameraman.png",
  "assets/2d/char_director.png",
  "assets/2d/char_extra.png",
  "assets/2d/char_female_walk0.png",
  "assets/2d/char_male_idle.png",
  "assets/2d/char_male_walk0.png",
  "assets/2d/char_male_walk1.png",
  "assets/2d/char_star_actor.png",
  "assets/2d/cinema_theater.png",
  "assets/2d/executive.png",
  "assets/2d/kairo_cinema_theater.png",
  "assets/2d/kairo_executive_office.png",
  "assets/2d/kairo_post_suite.png",
  "assets/2d/kairo_soundstage.png",
  "assets/2d/kairo_studio_campus.png",
  "assets/2d/kairo_writers_room.png",
  "assets/2d/post_suite.png",
  "assets/2d/soundstage.png",
  "assets/2d/studio_gate.png",
  "assets/2d/tile_concrete.png",
  "assets/2d/tile_grass.png",
  "assets/2d/tile_plaza.png",
  "assets/2d/tile_road.png",
  "assets/2d/virtual_led.png",
  "assets/2d/writers_bungalow.png",
  "assets/itch-avatars/Avatars_01.png",
  "assets/itch-avatars/Avatars_02.png",
  "assets/itch-avatars/Avatars_03.png",
  "assets/itch-avatars/Avatars_04.png",
  "assets/itch-avatars/Avatars_05.png",
  "assets/itch-avatars/Avatars_06.png",
  "assets/itch-avatars/Avatars_07.png",
  "assets/itch-avatars/Avatars_08.png",
  "assets/itch-avatars/Avatars_09.png",
  "assets/itch-avatars/Avatars_10.png",
  "assets/itch-avatars/Avatars_11.png",
  "assets/itch-avatars/Avatars_12.png",
  "assets/itch-avatars/Avatars_13.png",
  "assets/itch-avatars/Avatars_14.png",
  "assets/itch-avatars/Avatars_15.png",
  "assets/itch-avatars/Avatars_16.png",
  "assets/itch-avatars/Avatars_17.png",
  "assets/itch-avatars/Avatars_18.png",
  "assets/itch-avatars/Avatars_19.png",
  "assets/itch-avatars/Avatars_20.png",
  "assets/itch-avatars/Avatars_21.png",
  "assets/itch-avatars/Avatars_22.png",
  "assets/itch-avatars/Avatars_23.png",
  "assets/itch-avatars/Avatars_24.png",
  "assets/itch-avatars/Avatars_25.png",
  "assets/itch-ui/banners/Banner.png",
  "assets/itch-ui/banners/Banner_Slots.png",
  "assets/itch-ui/buttons/BigBlueButton_Regular.png",
  "assets/itch-ui/buttons/BigRedButton_Regular.png",
  "assets/itch-ui/buttons/SmallBlueRoundButton_Regular.png",
  "assets/itch-ui/papers/RegularPaper.png",
  "assets/itch-ui/wood/WoodTable.png",
  "assets/pixel-characters/char-female-1.png",
  "assets/pixel-characters/char-female-2.png",
  "assets/pixel-characters/char-female-cheer.png",
  "assets/pixel-characters/char-male-1.png",
  "assets/pixel-characters/char-male-2.png",
  "assets/pixel-characters/char-male-cheer.png",
  "assets/pixel-characters/char-robot.png",
  "assets/pixel-characters/char-zombie.png"
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
  // Online code must not be shadowed by an older unversioned offline entry.
  // Keep both forms fresh so offline reloads retain the newly loaded renderer.
  const url = new URL(e.request.url);
  if (url.origin === location.origin && /\.(?:js|css)$/.test(url.pathname) && url.searchParams.has("v")) {
    e.respondWith((async () => {
      try {
        const res = await fetch(e.request);
        if (!res.ok) throw new Error("App code unavailable");
        const c = await caches.open(CACHE), canonical = new URL(url);
        canonical.search = "";
        await Promise.all([c.put(canonical.href, res.clone()), c.put(e.request, res.clone())]);
        return res;
      } catch (error) {
        const hit = await caches.match(e.request, { ignoreSearch: true });
        if (hit) return hit;
        return Response.error();
      }
    })());
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
