import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// App theme colours (kept in sync with src/styles.css: --cream / --purple).
const CREAM = "#fbefc7";
const PURPLE = "#4f3d9c";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // Extra files (already in public/) to make sure they land in the precache.
      includeAssets: ["sir-tone.png", "apple-touch-icon.png"],
      manifest: {
        name: "Sir Tone's Music Studio",
        short_name: "Sir Tone",
        description:
          "Play brain, gut and skin sonifications in playful styles — works fully offline.",
        display: "standalone",
        orientation: "landscape",
        background_color: CREAM,
        theme_color: PURPLE,
        start_url: ".",
        scope: ".",
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Precache the WHOLE app so it runs offline after one online visit:
        // built JS/CSS/HTML, icons/images, every audio clip and every signal JSON.
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest,woff,woff2,wav,mid,json}"],
        // Largest clip is ~1.2 MB; lift the default 2 MiB cap with headroom.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        // Single-page app: serve index.html for offline navigations.
        navigateFallback: "index.html",
        // Don't let the SPA fallback swallow asset requests.
        navigateFallbackDenylist: [/^\/audio\//, /^\/signals\//],
        runtimeCaching: [
          // Google Fonts stylesheet + font files — cache-first so the app keeps
          // its Lilita One / Nunito look offline once seen online.
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-stylesheets",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        // Keep the SW off during `vite dev` so it doesn't cache work-in-progress.
        enabled: false,
      },
    }),
  ],
});
