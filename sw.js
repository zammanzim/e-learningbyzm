// ==========================================
// CLASS APP — SERVICE WORKER v1.0
// ==========================================

const CACHE_NAME = 'classapp-v1';
const OFFLINE_PAGE = '/announcements';

// Asset statis yang di-cache saat install
const STATIC_ASSETS = [
    '/announcements',
    '/tugas',
    '/css/styleasli.css',
    '/js/basicfeat.js',
    '/js/auth.js',
    '/js/visitor.js',
    '/js/supabase-clients.js',
    '/js/ui-components.js',
    '/js/subject-manager.js',
    '/js/tugas.js',
    '/js/daily-card.js',
    '/js/kisi-kisi.js',
    '/manifest.json',
    '/icons/announcements.png',
    '/icons/checklist.png',
];

// ==========================================
// INSTALL — Cache semua aset statis
// ==========================================
self.addEventListener('install', (event) => {
    console.log('[SW] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // addAll bisa gagal kalau satu URL 404, jadi kita catch per-item
            return Promise.allSettled(
                STATIC_ASSETS.map(url =>
                    cache.add(url).catch(err => console.warn('[SW] Gagal cache:', url, err))
                )
            );
        }).then(() => {
            console.log('[SW] Install selesai!');
            return self.skipWaiting();
        })
    );
});

// ==========================================
// ACTIVATE — Hapus cache lama
// ==========================================
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => {
                        console.log('[SW] Hapus cache lama:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => self.clients.claim())
    );
});

// ==========================================
// FETCH — Strategi Cache
// ==========================================
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // 1. Skip Supabase API — selalu dari network (jangan di-cache)
    if (url.hostname.includes('supabase.co')) return;

    // 2. Skip CDN external (Font Awesome, Supabase JS) — biarkan browser handle
    if (url.hostname.includes('cdn.jsdelivr.net') ||
        url.hostname.includes('cdnjs.cloudflare.com') ||
        url.hostname.includes('fonts.googleapis.com') ||
        url.hostname.includes('fonts.gstatic.com')) {
        event.respondWith(
            caches.match(request).then(cached => cached || fetch(request).then(res => {
                if (res && res.status === 200) {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then(c => c.put(request, clone));
                }
                return res;
            }))
        );
        return;
    }

    // 3. HTML pages — Network First, fallback ke cache
    if (request.destination === 'document' || request.headers.get('accept')?.includes('text/html')) {
        event.respondWith(
            fetch(request)
                .then(res => {
                    if (res && res.status === 200) {
                        const clone = res.clone();
                        caches.open(CACHE_NAME).then(c => c.put(request, clone));
                    }
                    return res;
                })
                .catch(() => caches.match(request) || caches.match(OFFLINE_PAGE))
        );
        return;
    }

    // 4. CSS, JS, Images — Cache First, update di background
    event.respondWith(
        caches.match(request).then(cached => {
            const fetchPromise = fetch(request).then(res => {
                if (res && res.status === 200 && res.type !== 'opaque') {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then(c => c.put(request, clone));
                }
                return res;
            }).catch(() => null);

            return cached || fetchPromise;
        })
    );
});

// ==========================================
// PUSH NOTIFICATIONS
// ==========================================
self.addEventListener('push', (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch (e) {
        data = { title: 'Class App', body: event.data?.text() || 'Ada notifikasi baru!' };
    }

    const title = data.title || 'Class App';
    const options = {
        body: data.body || 'Ada update baru di kelas kamu!',
        icon: '/icons/announcements.png',
        badge: '/icons/announcements.png',
        tag: data.tag || 'classapp-notif',
        renotify: true,
        data: { url: data.url || '/announcements' },
        vibrate: [200, 100, 200, 100, 200],
        actions: [
            { action: 'open', title: '📖 Buka', icon: '/icons/announcements.png' },
            { action: 'close', title: '✕ Tutup' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'close') return;

    const targetUrl = event.notification.data?.url || '/announcements';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // Fokus kalau udah ada tab yang kebuka
            for (const client of windowClients) {
                if (client.url.includes(targetUrl) && 'focus' in client) {
                    return client.focus();
                }
            }
            // Buka tab baru kalau belum ada
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});

// ==========================================
// BACKGROUND SYNC (opsional, untuk future use)
// ==========================================
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-tugas') {
        console.log('[SW] Background sync: tugas');
    }
});