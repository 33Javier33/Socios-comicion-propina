// Service Worker de la app de Horarios (index2.html).
// Alcance acotado a /index2.html para NO afectar la app principal (index.html).
const CACHE = 'horarios-mesas-v28';
const ASSETS = ['/index2.html', '/manifest2.json', '/img/horarios-192.png', '/img/horarios-512.png', '/img/marca/cpn-marca.png'];

// Sin skipWaiting a propósito: la versión nueva queda EN ESPERA y la página
// muestra un banner para que la persona decida cuándo aplicarla. Antes se
// activaba sola y la app podía recargarse a mitad de lo que se estaba
// haciendo — y como la sesión no se guardaba, volvía a pedir el PIN.
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {})));
});

// La página pide aplicar la actualización al tocar "Actualizar".
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
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

// Responde con su propia versión. Lo pregunta version.js: es el único dato
// fiable, porque puede haber una caché más nueva instalada y EN ESPERA —acá
// la versión nueva no se activa sola— y desde la página no hay forma de
// distinguir cuál de las dos está controlando de verdad.
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'VERSION') {
        const v = CACHE;
        if (event.ports && event.ports[0]) event.ports[0].postMessage(v);
    }
});
