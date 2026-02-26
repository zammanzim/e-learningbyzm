const CACHE_NAME = 'pwa-test-v1';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    clients.claim();
});

self.addEventListener('fetch', () => {
    // network-first (minimal)
});
