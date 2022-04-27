import { getFiles, setupPrecaching, setupRouting } from 'preact-cli/sw';
import { BackgroundSyncPlugin } from 'workbox-background-sync';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, NetworkOnly, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';
import { skipWaiting, clientsClaim } from 'workbox-core';

skipWaiting();
clientsClaim();

const bgSyncPlugin = new BackgroundSyncPlugin('apiRequests', {
    maxRetentionTime: 60  // retry for up to one hour (in minutes)
});

// Detect and register any fetch calls using 'https://' and use the Network First Strategy by Workbox
registerRoute(/(?:https:\/\/.*)/, new NetworkFirst());

registerRoute(
    ({request}) => request.destination === 'script' ||
                   request.destination === 'style',
    new StaleWhileRevalidate()
);

registerRoute(
    ({request}) => request.destination === 'image',
    new CacheFirst({
      cacheName: 'images',
      plugins: [
        new CacheableResponsePlugin({
          statuses: [0, 200],
        }),

        new ExpirationPlugin({
          maxEntries: 60,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
        }),
      ],
    }),
  );


registerRoute(
  ({ url }) => url.pathname.startsWith("/species/"),
  new NetworkOnly({ //NetworkFirst
        plugins: [bgSyncPlugin]
  })
);

registerRoute(
  ({ url }) => url.pathname.startsWith("/api/"),
  new NetworkOnly({ //NetworkFirst
        plugins: [bgSyncPlugin]
  })
);

/** Preact CLI setup */
setupRouting();

const urlsToCache = getFiles();
//urlsToCache.push({url: 'assets/icons/favicon.png', revision: null});
setupPrecaching(urlsToCache);
