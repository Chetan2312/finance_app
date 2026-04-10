// ══════════════════════════════════════
// SW.JS — Service Worker (Phase 7)
// Cache-first for app shell assets.
// Network-first for external CDN scripts.
// All localStorage data remains on device.
// ══════════════════════════════════════

const CACHE = 'ff7-v4';

// App shell — all local files needed to run offline
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/tokens.css',
  './css/base.css',
  './css/components.css',
  './css/responsive.css',
  './js/app.js',
  './js/utils.js',
  './js/state.js',
  './js/storage.js',
  './data/defaults.js',
  './js/modules/modals.js',
  './js/modules/expenses.js',
  './js/modules/debts.js',
  './js/modules/sips.js',
  './js/modules/daily.js',
  './js/modules/overview.js',
  './js/modules/budget.js',
  './js/modules/reports.js',
  './js/modules/statements.js',
  './js/modules/milestones.js',
  './js/modules/invest.js',
  './js/modules/theme.js',
  './js/modules/ai.js',
];

// ── Install: pre-cache app shell ──
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

// ── Activate: remove old caches ──
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first for local, network-only for external ──
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Always go network-only for:
  // 1. Anthropic API calls (never cache)
  // 2. External CDN resources (Chart.js, jsPDF, etc.)
  if (url.hostname !== self.location.hostname) {
    e.respondWith(fetch(e.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // Cache-first for same-origin app shell assets
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        // Only cache successful GET responses
        if (e.request.method !== 'GET' || !res.ok) return res;
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      });
    })
  );
});
