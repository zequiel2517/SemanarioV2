// Semanario Familiar — Service Worker
// Estrategia: "primero red" (network-first). Online siempre baja lo último;
// la caché solo se usa como respaldo cuando no hay conexión.
// Sube SW_VERSION para forzar actualización del propio SW.
const SW_VERSION = 'v22';
const CACHE = 'semanario-' + SW_VERSION;

// Recursos propios que conviene tener en caché para el modo offline básico.
const ASSETS = [
  './',
  './index.html',
  './login.html',
  './supabase-client.js',
  './manifest.webmanifest',
  './icono_192x192.png',
  './icono_512x512.png',
  './icono_maskable_192.png',
  './icono_maskable_512.png',
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS).catch(() => {})));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                 // solo GET
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;       // deja pasar Supabase/esm.sh sin tocar

  e.respondWith((async () => {
    try {
      const fresh = await fetch(req);               // primero red
      const cache = await caches.open(CACHE);
      cache.put(req, fresh.clone());                // refresca la caché
      return fresh;
    } catch (err) {
      const cached = await caches.match(req);       // sin red -> respaldo de caché
      if (cached) return cached;
      throw err;
    }
  })());
});
