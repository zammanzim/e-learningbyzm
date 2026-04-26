const CACHE_NAME = 'elearniz-v1';
const STATIC_ASSETS = [
  '/',
  '/announcements',
  '/css/styleasli.css',
  '/js/supabase-clients.js',
  '/js/ui-components.js',
  '/js/basicfeat.js',
  '/js/auth.js',
  '/js/theme.js',
  '/js/toast.js',
  '/icons/profpicture.png'
];

// Install — cache aset statis
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Kalau ada yang gagal cache (file gak ada dll), skip aja
      });
    })
  );
  self.skipWaiting();
});

// Activate — hapus cache lama
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — network first, fallback ke cache
self.addEventListener('fetch', (e) => {
  // Skip non-GET dan request ke supabase (biar realtime tetap jalan)
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('supabase.co')) return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // Cache response segar
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});