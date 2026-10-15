/* Árvores Urbanas — service worker do SITE (página inicial).
   Substitui o service worker antigo (V2), que guardava o app neste endereço.
   O app tem o próprio service worker em /app/sw.js. */
const CACHE = 'arvores-site-1';
const FILES = ['./', 'site.css', 'site.js', 'conteudo.js', 'manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  // apaga a cópia antiga do app (V2) e versões velhas do site; não mexe no app (arvores-app-*) nem nos dados das árvores
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => (k.startsWith('arvores-site') && k !== CACHE) || k.startsWith('arvores-da-cidade')).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/app/') && url.pathname !== '/app/sw.js') {
    // o app: internet primeiro; sem internet, o que o app guardou
    e.respondWith(fetch(req).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || Response.error())));
    return;
  }
  // site: internet primeiro (para textos e fotos novos aparecerem), cópia guardada se estiver sem internet
  e.respondWith(
    fetch(req, { cache: 'no-cache' }).then((res) => {
      if (res && res.ok && !url.pathname.startsWith('/fotos/')) { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || (req.mode === 'navigate' ? caches.match('./') : null)).then((r) => r || Response.error()))
  );
});
