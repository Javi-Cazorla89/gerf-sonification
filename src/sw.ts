/// <reference lib="webworker" />
//
// Custom service worker for offline-on-iPad. Strategy:
//   * App shell + signal JSON + icons -> Workbox precache (cache-first).
//   * Audio (/audio/**) -> a dedicated CacheFirst cache with RangeRequestsPlugin
//     so iPad Safari's partial (Range: bytes=...) media requests get 206s. The
//     cache is WARMED on install so every clip is available offline up-front,
//     not just clips that happened to be played while online.
//   * Google Fonts -> CacheFirst so the app keeps its look offline.
//
// This file is bundled by vite-plugin-pwa (injectManifest); it is excluded from
// the app's tsc type-check (see tsconfig.app.json).
import {
  precacheAndRoute,
  createHandlerBoundToURL,
  cleanupOutdatedCaches,
} from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { CacheFirst } from "workbox-strategies";
import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { RangeRequestsPlugin } from "workbox-range-requests";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

const AUDIO_CACHE = "gerf-audio-v1";
const FONTS_CACHE = "gerf-fonts-v1";

// Matches both precache-manifest URLs ("audio/funny/x.wav", relative, no leading
// slash) and runtime request pathnames ("/audio/funny/x.wav").
const AUDIO_RE = /(^|\/)audio\//;
const isAudio = (path: string) => AUDIO_RE.test(path);

// vite-plugin-pwa injects the full precache list here (shell + signals + icons
// + audio). Split it: audio goes to the range-capable runtime cache, the rest
// is precached normally.
const manifest = self.__WB_MANIFEST || [];
const audioEntries = manifest.filter((e) => isAudio(e.url));
const shellEntries = manifest.filter((e) => !isAudio(e.url));

cleanupOutdatedCaches();
precacheAndRoute(shellEntries);

// --- Audio: CacheFirst + Range support ------------------------------------
const audioStrategy = new CacheFirst({
  cacheName: AUDIO_CACHE,
  plugins: [new CacheableResponsePlugin({ statuses: [200] }), new RangeRequestsPlugin()],
});
registerRoute(({ url }) => url.origin === self.location.origin && isAudio(url.pathname), audioStrategy);

// --- Google Fonts: CacheFirst ---------------------------------------------
registerRoute(
  ({ url }) =>
    url.origin === "https://fonts.googleapis.com" || url.origin === "https://fonts.gstatic.com",
  new CacheFirst({
    cacheName: FONTS_CACHE,
    plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
  }),
);

// --- SPA navigation fallback (don't swallow audio/signals) ----------------
registerRoute(
  new NavigationRoute(createHandlerBoundToURL("index.html"), {
    denylist: [/^\/audio\//, /^\/signals\//],
  }),
);

// --- Warm the audio cache on install --------------------------------------
// Block activation until every clip has been attempted, so once the SW is
// controlling the page we know the audio is cached. Tolerate individual
// failures (best-effort) so one bad fetch can't break the whole install.
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(AUDIO_CACHE);
      await Promise.allSettled(
        audioEntries.map(async ({ url }) => {
          try {
            const existing = await cache.match(url);
            if (existing) return;
            const res = await fetch(url, { cache: "reload" });
            if (res.ok) await cache.put(url, res.clone());
          } catch {
            /* best-effort */
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
