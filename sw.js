/* Árvores Urbanas — service worker: guarda o app no aparelho para abrir sem internet. */
const CACHE = 'arvores-da-cidade-v1.0.9';
const FILES = ['./', 'index.html', 'style.css', 'geo.js', 'zip.js', 'db.js', 'ui.js', 'species.js', 'stamp.js', 'place.js', 'export.js', 'map.js', 'app.js', 'form.js', 'more.js',
  'manifest.webmanifest', 'fonts/Mali-Regular.ttf', 'fonts/Mali-Bold.ttf', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png', 'icons/icon-32.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // mapa, busca de local etc.: direto da internet
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req, { ignoreSearch: true });
      const net = fetch(req).then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
      if (hit) { e.waitUntil(net); return hit; }
      const res = await net;
      if (res) return res;
      if (req.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
      return Response.error();
    })
  );
});
