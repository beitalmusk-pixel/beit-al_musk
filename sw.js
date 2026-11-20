/**
 * بيت المسك • BEIT AL-MUSK
 * Service Worker — خلفية التخزين المؤقت وتثبيت تطبيق الويب (PWA)
 */

const CACHE_NAME = 'beit-al-musk-v2';
const STATIC_ASSETS = [
  './',
  './index.html',
  './admin.html',
  './css/styles.css',
  './assets/logo.jpg',
  './assets/products/sokoon.jpg',
  './assets/products/moon-night.jpg',
  './assets/products/miss-allure.jpg',
  './assets/products/sakura.jpg',
  './js/products.js',
  './js/storage.js',
  './js/cart.js',
  './js/checkout.js',
  './js/app.js',
  './js/supabase-config.js',
  './js/supabase-client.js',
  './manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(err => console.warn('PWA Cache note:', err));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // تفعيل الاتصال المباشر لقاعدة البيانات السحابية ومصادر البيانات الحية
  if (e.request.url.includes('supabase.co') || e.request.url.includes('firebaseio.com') || e.request.url.includes('googleapis.com')) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetchPromise = fetch(e.request).then((networkRes) => {
        if (networkRes && networkRes.status === 200 && e.request.method === 'GET') {
          const clone = networkRes.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return networkRes;
      }).catch(() => cached);

      return cached || fetchPromise;
    })
  );
});
