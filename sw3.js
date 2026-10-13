// Service Worker de Comunicación con Áreas (index3.html).
// Alcance acotado a /index3 para NO tocar index.html ni index2.html.
const CACHE = 'comunicacion-v1';
const ASSETS = ['/index3.html', '/manifest3.json',
                '/img/comunicacion-192.png', '/img/comunicacion-512.png'];

// Igual que Horarios: la versión nueva queda EN ESPERA y no se activa sola,
// para no recargar la pantalla a mitad de un formulario a medio llenar.
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {})));
});
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (e.data && e.data.type === 'VERSION' && e.ports && e.ports[0]) e.ports[0].postMessage(CACHE);
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(
    ks.filter(k => k.startsWith('comunicacion-') && k !== CACHE).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});
// Red primero: los datos vienen de Supabase y nunca se cachean; la caché
// es solo para que la app abra sin conexión.
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (!/\/index3\.html$|\/manifest3\.json$|comunicacion-\d+\.png$|^\/$/.test(u.pathname)) return;
  e.respondWith(
    fetch(e.request).then(r => {
      if (r && r.status === 200) { const c = r.clone(); caches.open(CACHE).then(k => k.put(e.request, c)); }
      return r;
    }).catch(() => caches.match(e.request))
  );
});
