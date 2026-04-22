const CACHE_NAME = 'alarm-remote-v1';
const RUNTIME_CACHE = 'alarm-remote-runtime-v1';
const STATIC_ASSETS = [
  '/',
  '/offline.html'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Fail silently if assets don't exist yet
        return Promise.resolve();
      });
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            return caches.delete(cacheName);
          }
          return Promise.resolve();
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip Supabase API calls - always network
  if (url.origin.includes('supabase')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({ error: 'Offline - cannot reach Supabase' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // For same-origin requests: network first, cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Only cache successful responses
        if (response && response.status === 200 && response.type !== 'error') {
          const clonedResponse = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, clonedResponse);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache on network failure
        return caches.match(request).then((response) => {
          if (response) {
            return response;
          }
          // If neither network nor cache, return offline page for navigation requests
          if (request.destination === 'document') {
            return caches.match('/offline.html').catch(() => {
              return new Response('Offline - please check your connection', {
                status: 503,
                headers: { 'Content-Type': 'text/plain' }
              });
            });
          }
          return new Response('Asset unavailable offline', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
          });
        });
      })
  );
});

// Background sync for commands (experimental)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-alarm-commands') {
    event.waitUntil(
      fetch('/api/sync-commands', {
        method: 'POST'
      }).catch(() => {
        // Retry later if offline
      })
    );
  }
});

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
