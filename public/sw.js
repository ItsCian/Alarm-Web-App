const CACHE_NAME = 'alarm-remote-v2';
const RUNTIME_CACHE = 'alarm-remote-runtime-v2';
const STATIC_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/logo.svg',
  '/icon-192.svg',
  '/icon-512.svg',
  '/notification-badge.svg'
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

// Show push notifications when a push event is received.
self.addEventListener('push', (event) => {
  let payload = {
    title: 'Alarm update',
    body: 'You have a new alarm event.',
    tag: 'alarm-update',
    icon: '/icon-192.svg',
    badge: '/notification-badge.svg',
    url: '/remote'
  };

  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag || 'alarm-update',
      icon: payload.icon || '/icon-192.svg',
      badge: payload.badge || '/notification-badge.svg',
      data: {
        url: payload.url || '/remote'
      }
    })
  );
});

// Focus an existing app window (or open one) when a notification is clicked.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/remote';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) {
            client.navigate(targetUrl);
          }
          return;
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
