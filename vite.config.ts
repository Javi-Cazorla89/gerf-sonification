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
      // Custom service worker (src/sw.ts): app shell + signals are precached,
      // audio is served via a Range-capable CacheFirst cache that's warmed on
      // install — so iPad Safari's partial (Range) audio requests work offline.
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
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
      injectManifest: {
        // Include EVERYTHING in the manifest the SW reads: app shell, icons,
        // signal JSON, and every audio clip. sw.ts precaches the shell/signals
        // and warm-caches the audio separately.
        globPatterns: [
          "**/*.{js,css,html,ico,png,svg,webmanifest,woff,woff2,wav,mid,json}",
        ],
        // Largest clip is ~1.2 MB — lift the default 2 MiB cap so audio is
        // included in the manifest (and therefore warmed on install).
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      devOptions: {
        // Keep the SW off during `vite dev` so it doesn't cache work-in-progress.
        enabled: false,
      },
    }),
  ],
});
