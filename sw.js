/* Cay's Money Tracker — service worker
   Menyimpan semua file aplikasi di cache supaya bisa dibuka tanpa internet.
   Jika suatu saat file aplikasi diubah, naikkan angka versi di bawah (mis. v2 -> v3). */
const CACHE = 'cays-money-v4';

const ASSETS = [
  './',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith('cays-money-') && key !== CACHE).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// Respons hasil redirect tidak boleh dipakai untuk navigasi; salin ulang supaya aman.
function cleanResponse(response) {
  if (!response || !response.redirected) return Promise.resolve(response);
  return response.blob().then((body) => new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  }));
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Membuka aplikasi (halaman): pakai index dari cache, jadi tetap jalan saat offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('./', { ignoreSearch: true })
        .then((cached) => cached || fetch(request))
        .then(cleanResponse)
        .catch(() => caches.match('./', { ignoreSearch: true }))
    );
    return;
  }

  // File lain: cache dulu, kalau belum ada ambil dari jaringan lalu simpan.
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
