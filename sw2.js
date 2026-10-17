// Service Worker de la app de Horarios (index2.html).
// Alcance acotado a /index2.html para NO afectar la app principal (index.html).
const CACHE = 'horarios-mesas-v37';
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

// ══════════════════════════════════════════════════════════════════════
// AVISOS DEL TURNO CON LA APP CERRADA
//
// La página deja el plan del día en la caché `horarios-plan-avisos`, y acá
// se revisa cada tanto y se dispara lo que ya venció.
//
// Esto depende de `periodicSync`, que hoy existe en Android con la app
// instalada en la pantalla de inicio, y el navegador decide cada cuánto
// corre de verdad. En iPhone no existe: ahí los avisos llegan cuando el
// socio abre la app. No es push de servidor y no pretende serlo.
// ══════════════════════════════════════════════════════════════════════
const PLAN_CACHE = 'horarios-plan-avisos';

async function _avisosPendientes() {
  try {
    const c = await caches.open(PLAN_CACHE);
    const r = await c.match('/plan');
    if (!r) return { c: null, plan: null };
    return { c, plan: await r.json() };
  } catch (e) { return { c: null, plan: null }; }
}

async function _dispararAvisos() {
  const { c, plan } = await _avisosPendientes();
  if (!c || !plan || !Array.isArray(plan.avisos)) return;
  // Un plan de ayer no sirve: la página lo rehace al abrirse.
  if (Date.now() - (plan.guardado || 0) > 36 * 3600000) return;
  const ahora = Date.now();
  const quedan = [];
  for (const a of plan.avisos) {
    if (a.cuando <= ahora) {
      try {
        await self.registration.showNotification(a.titulo, {
          body: a.cuerpo, tag: a.llave,
          icon: '/img/horarios-192.png', badge: '/img/horarios-192.png'
        });
      } catch (e) { /* si no se puede mostrar, se deja pendiente */ quedan.push(a); }
    } else quedan.push(a);
  }
  await c.put('/plan', new Response(JSON.stringify({ guardado: plan.guardado, avisos: quedan }),
    { headers: { 'Content-Type': 'application/json' } }));
}

self.addEventListener('periodicsync', event => {
  if (event.tag === 'horarios-avisos') event.waitUntil(_dispararAvisos());
});

// ══════════════════════════════════════════════════════════════════════
// PUSH DE SERVIDOR — lo único que llega con la app CERRADA
//
// Faltaba este listener, y era la causa de fondo: sin él, aunque el
// servidor mandara el aviso, el teléfono no tenía qué mostrar. Todo lo
// de arriba (temporizadores y `periodicSync`) necesita que la app esté
// abierta o que el navegador decida correr una tarea en segundo plano
// —cosa que en iPhone no existe y en Android casi nunca pasa—, así que
// los avisos terminaban apareciendo recién al abrir la app.
//
// Lo manda la Edge Function `push-notify` del proyecto de socios, la
// misma que ya le avisa al administrador. Formato: { title, body, url }.
// ══════════════════════════════════════════════════════════════════════
self.addEventListener('push', event => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; }
  catch (e) { d = { title: 'Horarios', body: (event.data && event.data.text()) || '' }; }
  event.waitUntil(self.registration.showNotification(d.title || 'Horarios', {
    body: d.body || '',
    icon: '/img/horarios-192.png',
    badge: '/img/horarios-192.png',
    tag: d.tag || 'horario',
    renotify: true,
    vibrate: [90, 50, 90],
    data: { url: d.url || '/index2.html' }
  }));
});

// Al tocar el aviso se abre la app, o se trae al frente la que ya estaba.
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/index2.html';
  event.waitUntil((async () => {
    const lista = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const abierta = lista.find(c => c.url.includes('index2'));
    if (abierta) return abierta.focus();
    if (self.clients.openWindow) return self.clients.openWindow(url);
  })());
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
