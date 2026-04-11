// Cahoon service worker — network-first, no caching of CSV data
const CACHE_NAME = 'cahoon-v1'
const STATIC_ASSETS = ['/', '/index.html']

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS).catch(() => {}))
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  // Always network-first; fall back to cache for shell only
  const url = new URL(event.request.url)
  if (url.hostname.includes('google') || url.hostname.includes('supabase')) {
    // Never cache external data requests
    return
  }
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  )
})
