/* Elder Realms AI Service Worker (Vite build) */
const SW_VERSION = 'v1.1.0';
const PRECACHE = `precache-${SW_VERSION}`;
const RUNTIME_IMG = `images-${SW_VERSION}`;
const RUNTIME_FONT = `fonts-${SW_VERSION}`;
const RUNTIME_OTHER = `runtime-${SW_VERSION}`;

// Core assets to precache for offline shell
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/sw.js',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE);
      await Promise.allSettled(
        PRECACHE_URLS.map((url) => fetch(url, { cache: 'no-store' }).then((res) => cache.put(url, res)))
      );
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const allow = new Set([PRECACHE, RUNTIME_IMG, RUNTIME_FONT, RUNTIME_OTHER]);
      await Promise.all(keys.filter((k) => !allow.has(k)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

function isImageRequest(req) {
  const dest = req.destination;
  if (dest === 'image') return true;
  const url = new URL(req.url);
  return /(\.(png|jpg|jpeg|gif|webp|svg|avif)$)/i.test(url.pathname);
}

function isFontRequest(req) {
  const dest = req.destination;
  if (dest === 'font') return true;
  const url = new URL(req.url);
  return /(\.(woff2?|ttf|otf)$)/i.test(url.pathname) || url.hostname.includes('fonts.gstatic.com');
}

function isLottieOrJSON(req) {
  const url = new URL(req.url);
  return url.pathname.endsWith('.json') && (url.hostname.includes('lottiefiles.com') || url.hostname.includes('assets'));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // App shell navigation fallback: serve index.html when offline for SPA routes
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const netRes = await fetch(request);
          return netRes;
        } catch (e) {
          const cache = await caches.open(PRECACHE);
          const cached = await cache.match('/index.html');
          return cached || new Response('<h1>Offline</h1>', { headers: { 'Content-Type': 'text/html' } });
        }
      })()
    );
    return;
  }

  // Images: Cache-first
  if (isImageRequest(request)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(RUNTIME_IMG);
        const cached = await cache.match(request, { ignoreVary: true });
        if (cached) return cached;
        try {
          const netRes = await fetch(request);
          cache.put(request, netRes.clone());
          return netRes;
        } catch (e) {
          const precache = await caches.open(PRECACHE);
          const fallback = await precache.match(request);
          return fallback || Response.error();
        }
      })()
    );
    return;
  }

  // Fonts/styles: Stale-while-revalidate
  if (isFontRequest(request) || request.destination === 'style' || request.url.includes('fonts.googleapis.com')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(RUNTIME_FONT);
        const cached = await cache.match(request);
        const fetchPromise = fetch(request).then((res) => { cache.put(request, res.clone()); return res; }).catch(() => cached);
        return cached || fetchPromise;
      })()
    );
    return;
  }

  // JSON/Lottie: Stale-while-revalidate
  if (isLottieOrJSON(request)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(RUNTIME_OTHER);
        const cached = await cache.match(request);
        const fetchPromise = fetch(request).then((res) => { cache.put(request, res.clone()); return res; }).catch(() => cached);
        return cached || fetchPromise;
      })()
    );
    return;
  }

  // Default: network-first for same-origin GET
  if (request.method === 'GET' && new URL(request.url).origin === self.location.origin) {
    event.respondWith(
      (async () => {
        try {
          const netRes = await fetch(request);
          const cache = await caches.open(RUNTIME_OTHER);
          cache.put(request, netRes.clone());
          return netRes;
        } catch (e) {
          const cache = await caches.open(RUNTIME_OTHER);
          const cached = await cache.match(request);
          return cached || Response.error();
        }
      })()
    );
  }
});

// Notifications: focus client and route to rounds on click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (clientsList && clientsList.length) {
      const client = clientsList[0];
      await client.focus();
      try { client.postMessage({ type: 'open-rounds' }); } catch {}
      return;
    }
    await self.clients.openWindow('/?m=1');
  })());
});
