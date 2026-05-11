'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker that powers offline mode.
 *
 * The service worker:
 *   • Pre-caches the app shell so the UI loads when the network is down.
 *   • Uses stale-while-revalidate for navigation requests so users see something
 *     immediately even on a flaky connection.
 *   • Falls back to /offline when both cache and network miss.
 *
 * The IndexedDB data layer (lib/offline) is independent of the service worker —
 * it handles data persistence and the offline write queue.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') {
      // Dev builds change too often for SW caching to be useful.
      // Unregister anything lingering from a prior production build.
      navigator.serviceWorker
        .getRegistrations()
        .then((rs) => rs.forEach((r) => r.unregister()))
        .catch(() => {});
      return;
    }

    const onLoad = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch((err) => {
          console.warn('[offline] service worker registration failed', err);
        });
    };

    if (document.readyState === 'complete') onLoad();
    else window.addEventListener('load', onLoad, { once: true });

    return () => window.removeEventListener('load', onLoad);
  }, []);

  return null;
}
