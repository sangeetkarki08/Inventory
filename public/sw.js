/* eslint-disable */
// =============================================================================
//  public/sw.js — Service Worker for ConstructionIMS offline mode
//
//  Strategy:
//   • App shell + static assets: cache-first, populated on install + on demand.
//   • Navigations (HTML): network-first with cache fallback, then /offline.
//   • API/Supabase calls: pass through (never cached — they're authenticated and
//     the offline IndexedDB layer handles persistence separately).
//   • _next/static: cache-first (immutable, content-hashed).
//   • Manifest/icons: cache-first.
//
//  The cache version is baked into CACHE_NAME — bump it whenever the shell
//  changes and old caches are evicted automatically on activate.
// =============================================================================

const CACHE_VERSION = 'cims-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const PAGE_CACHE = `${CACHE_VERSION}-pages`;

const PRECACHE_URLS = [
  '/',
  '/offline',
  '/manifest.json',
  '/favicon-32.png',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
];

// ─── Install ────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) =>
        cache.addAll(
          PRECACHE_URLS.map((u) => new Request(u, { credentials: 'same-origin' })),
        ),
      )
      .catch((err) => {
        // Don't fail install if one asset is missing — log and keep going.
        console.warn('[sw] precache partial:', err);
      })
      .then(() => self.skipWaiting()),
  );
});

// ─── Activate ───────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            (k) => ![STATIC_CACHE, RUNTIME_CACHE, PAGE_CACHE].includes(k),
          )
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

// ─── Helpers ────────────────────────────────────────────────────────────────
function isSupabaseRequest(url) {
  // Anything going to Supabase or our own /api routes is dynamic — never cache.
  return (
    /\.supabase\.co$/i.test(url.hostname) ||
    /\.supabase\.in$/i.test(url.hostname) ||
    url.pathname.startsWith('/api/')
  );
}

function isNextStatic(url) {
  return url.pathname.startsWith('/_next/static/');
}

function isNextImage(url) {
  return url.pathname.startsWith('/_next/image');
}

function isStaticAsset(url) {
  return /\.(png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf|otf|css|js|json)$/i.test(
    url.pathname,
  );
}

// ─── Fetch ──────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Same-origin only — leave cross-origin requests (incl. Supabase) untouched.
  if (url.origin !== self.location.origin) return;

  // API + Supabase: always go to network (handled by app's offline queue).
  if (isSupabaseRequest(url)) return;

  // Navigations — network first, fall back to cached shell, then /offline.
  if (req.mode === 'navigate') {
    event.respondWith(handleNavigation(req));
    return;
  }

  // Next static chunks — cache-first (immutable).
  if (isNextStatic(url) || isNextImage(url)) {
    event.respondWith(cacheFirst(req, RUNTIME_CACHE));
    return;
  }

  // Other static assets in /public — cache-first.
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }
});

async function handleNavigation(req) {
  try {
    const fresh = await fetch(req);
    if (fresh.ok) {
      const cache = await caches.open(PAGE_CACHE);
      cache.put(req, fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch {
    const cached = await caches.match(req, { ignoreSearch: true });
    if (cached) return cached;
    const offline = await caches.match('/offline');
    if (offline) return offline;
    return new Response(
      '<h1>Offline</h1><p>This page is not cached and the network is unavailable.</p>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const fresh = await fetch(req);
    if (fresh.ok) cache.put(req, fresh.clone()).catch(() => {});
    return fresh;
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
}

// ─── Messaging ──────────────────────────────────────────────────────────────
// Allow the app to trigger an immediate update or cache purge.
self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data.type === 'CLEAR_CACHES') {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))),
    );
  }
});
