// Service Worker — Sistema Integral (Fondo Solidario, app admin)
const CACHE = 'fondo-admin-v12';
const CORE = ['/', 'index.html', 'styles.css', 'manifest.json', 'img/fondo-192.png', 'img/fondo-512.png'];

self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE).catch(() => {})));
});

// Activar cuando la app lo pida (banner "Actualizar")
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const url = event.request.url;
    // GAS y APIs externas → siempre red, no interceptar caché
    if (url.includes('script.google.com') || !url.startsWith(self.location.origin)) return;
    // Archivos propios → network-first. El HTML/navegación se pide sin caché HTTP (siempre fresco);
    // los JS/CSS se versionan con ?v= + headers no-cache, así que se revalidan solos.
    const esNav = event.request.mode === 'navigate' || /\.html(\?.*)?$/.test(url);
    const req = esNav ? new Request(event.request.url, { cache: 'no-store', credentials: 'same-origin' }) : event.request;
    event.respondWith(
        fetch(req).then(resp => {
            if (resp && resp.status === 200) { const cl = resp.clone(); caches.open(CACHE).then(c => c.put(event.request, cl)); }
            return resp;
        }).catch(() => caches.match(event.request))
    );
});
