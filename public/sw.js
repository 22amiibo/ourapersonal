// This file is served as-is in both dev and production. next-pwa wraps the app
// (next.config.ts) but its webpack-based GenerateSW step never runs under this
// project's Turbopack build (verified: a full `next build` writes no workbox-*.js /
// generates no sw.js — confirmed via build output + .next artifact search), so nothing
// regenerates or overwrites this file. It is the one real service worker.
const CACHE_VERSION = "v4";
const OFFLINE_QUEUE_KEY = "offline_queue";

self.addEventListener("install", () => { self.skipWaiting(); });

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", () => {
  // Pass-through — offline caching handled via IndexedDB queue below.
});

// ---- Push notifications ----
self.addEventListener("push", (event) => {
  if (!event.data) return;
  const { title = "Briefing", body = "", icon, badge, url, tag } = event.data.json();
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: icon || "/icon-192x192.png",
      badge: badge || "/icon-192x192.png",
      tag,
      data: { url: url || "/dashboard" },
    }).then(() => updateBadge())
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(targetUrl));
      return existing ? existing.focus() : self.clients.openWindow(targetUrl);
    })
  );
});

// ---- Badge API ----
async function updateBadge() {
  if (!("setAppBadge" in self.navigator)) return;
  try {
    const clients = await self.clients.matchAll({ type: "window" });
    // Badge count = 1 if unread push; cleared on focus
    await self.navigator.setAppBadge(1);
  } catch {}
}

self.addEventListener("message", (event) => {
  if (event.data?.type === "CLEAR_BADGE") {
    try { self.navigator.clearAppBadge?.(); } catch {}
  }
  if (event.data?.type === "FLUSH_QUEUE") {
    flushQueue();
  }
});

// ---- Offline queue (IndexedDB) ----
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("oura_offline", 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(OFFLINE_QUEUE_KEY, { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function flushQueue() {
  const db = await openDB();
  const tx = db.transaction(OFFLINE_QUEUE_KEY, "readwrite");
  const store = tx.objectStore(OFFLINE_QUEUE_KEY);
  const items = await new Promise((res, rej) => {
    const req = store.getAll();
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
  for (const item of items) {
    try {
      const r = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
      });
      if (r.ok) {
        store.delete(item.id);
      }
    } catch {}
  }
}
