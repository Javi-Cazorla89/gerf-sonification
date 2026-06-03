import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

/**
 * Small, unobtrusive badge that appears once the service worker has finished
 * caching the app, so the user knows it's safe to go offline / Airplane Mode.
 * Auto-dismisses after a few seconds; also shows a quiet "Update available"
 * pill when a newer build has been cached.
 */
const OfflineReadyBadge = () => {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  // Auto-hide the "offline ready" confirmation after a short while.
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (!offlineReady) return;
    const t = setTimeout(() => setHidden(true), 5000);
    return () => clearTimeout(t);
  }, [offlineReady]);

  if (needRefresh) {
    return (
      <div className="pwa-badge pwa-badge--update" role="status">
        <span>New version ready</span>
        <button type="button" onClick={() => updateServiceWorker(true)}>
          Reload
        </button>
        <button
          type="button"
          className="pwa-badge__close"
          aria-label="Dismiss"
          onClick={() => setNeedRefresh(false)}
        >
          ✕
        </button>
      </div>
    );
  }

  if (offlineReady && !hidden) {
    return (
      <div
        className="pwa-badge pwa-badge--ready"
        role="status"
        onClick={() => {
          setHidden(true);
          setOfflineReady(false);
        }}
      >
        <span className="pwa-badge__dot" aria-hidden>
          ✓
        </span>
        Offline ready
      </div>
    );
  }

  return null;
};

export default OfflineReadyBadge;
