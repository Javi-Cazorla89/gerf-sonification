import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

/**
 * Persistent offline status badge (bottom-left). It NEVER auto-hides, so once
 * the app is offline-ready that stays visible. Shows:
 *   - Service worker active: yes/no
 *   - Cache count (entries across all caches)
 *   - Offline ready: "Offline ready" vs "Caching…"
 *
 * "Offline ready" means the service worker controls the page — and because the
 * SW blocks activation until it has warmed the audio cache (see src/sw.ts),
 * being controlled implies the audio + shell are cached.
 */
const OfflineReadyBadge = () => {
  const {
    offlineReady: [offlineReady],
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  const [swActive, setSwActive] = useState(false);
  const [cacheCount, setCacheCount] = useState(0);

  // Poll the SW controller + Cache Storage so the status reflects warming live.
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      const active =
        typeof navigator !== "undefined" && !!navigator.serviceWorker?.controller;
      let count = 0;
      if (typeof caches !== "undefined") {
        try {
          for (const key of await caches.keys()) {
            const cache = await caches.open(key);
            count += (await cache.keys()).length;
          }
        } catch {
          // ignore — caches may be unavailable
        }
      }
      if (alive) {
        setSwActive(active);
        setCacheCount(count);
      }
    };
    void poll();
    const id = window.setInterval(poll, 1500);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  const ready = offlineReady || swActive;

  return (
    <div
      className={`pwa-badge ${ready ? "pwa-badge--ready" : "pwa-badge--caching"}`}
      role="status"
      aria-live="polite"
    >
      <span className="pwa-badge__dot" aria-hidden>
        {ready ? "✓" : "⏳"}
      </span>
      <span className="pwa-badge__text">
        <span className="pwa-badge__main">{ready ? "Offline ready" : "Caching…"}</span>
        <span className="pwa-badge__meta">
          SW: {swActive ? "yes" : "no"} · {cacheCount} cached
        </span>
      </span>
      {needRefresh && (
        <button
          type="button"
          className="pwa-badge__update"
          onClick={() => updateServiceWorker(true)}
        >
          Update
        </button>
      )}
    </div>
  );
};

export default OfflineReadyBadge;
