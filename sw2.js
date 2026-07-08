// Service Worker de la app de Horarios (index2.html).
// Alcance acotado a /index2.html para NO afectar la app principal (index.html).
const CACHE = 'horarios-mesas-v1';
const ASSETS = ['/index2.html', '/manifest2.json', '/img/horarios-192.png', '/img/horarios-512.png'];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {})));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Solo intercepta la página de horarios (network-first, con respaldo offline).
self.addEventListener('fetch', event => {
  const url = event.request.url;
  if (event.request.mode === 'navigate' || url.includes('/index2.html')) {
    event.respondWith(
      fetch(event.request)
        .then(r => { const cl = r.clone(); caches.open(CACHE).then(c => c.put(event.request, cl)); return r; })
        .catch(() => caches.match(event.request).then(m => m || caches.match('/index2.html')))
    );
  }
});
