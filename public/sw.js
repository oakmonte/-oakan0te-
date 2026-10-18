// Oakmonte's service worker: keeps the app's code on the phone so it opens
// from the device instead of re-downloading, and opens saved screens with no
// connection. Registered by src/lib/offline-app.ts with ?v=<build id>, so every
// deploy is a new worker -- that IS the update path (see offline-app.ts).
//
// What it does, and only this:
//   - /assets/* (content-hashed, never change): from the phone when saved,
//     otherwise from the network and saved. Always correct, since a changed
//     file gets a new name.
//   - Google Fonts: the same.
//   - Page loads: the NETWORK first, so content and new deploys are never
//     held back. Only when the network fails or is very slow does it answer
//     with the last saved copy of that page, or a small offline notice.
//   - Never touched: API routes, Supabase, payments, sign-in, checkout,
//     orders, messages, other origins. Those pages are never saved on the phone.
//
// KILL SWITCH. If this ever misbehaves in production, replace this whole file
// with:
//     self.addEventListener("install", () => self.skipWaiting());
//     self.addEventListener("activate", (e) => e.waitUntil(
//       caches.keys().then((ks) => Promise.all(ks.map((k) => caches.delete(k))))
//         .then(() => self.registration.unregister())));
// Browsers re-check this script on every page load, so every installed copy
// removes itself on its next visit.

const ASSETS = "oak-assets-v1";
const PAGES = "oak-pages-v1";
const FONTS = "oak-fonts-v1";
const KNOWN = [ASSETS, PAGES, FONTS];

const MAX_ASSETS = 400;
const MAX_PAGES = 40;
const MAX_FONTS = 60;
// On a slow connection, how long a page load waits for the network before the
// saved copy is used instead (the network answer still refreshes the copy).
const NAV_TIMEOUT_MS = 3500;

// Pages that are never saved: private, payment or auth flows.
const NEVER_SAVE = [
  "/api/",
  "/auth/",
  "/sign-in",
  "/sign-up",
  "/checkout",
  "/cart",
  "/order",
  "/orders",
  "/messages",
  "/store/orders",
  "/store/finance",
];

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith("oak-") && !KNOWN.includes(k)).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  // The page lists the /assets/* files it loaded before this worker was in
  // charge (the very first visit), so they're saved too.
  if (data.type === "oak-prime" && Array.isArray(data.urls)) {
    event.waitUntil(prime(data.urls));
  }
  // Sign-out: forget saved pages so the next person on this phone doesn't
  // open the last one's screens offline.
  if (data.type === "oak-clear-pages") {
    event.waitUntil(caches.delete(PAGES));
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.origin === "https://fonts.googleapis.com" || url.origin === "https://fonts.gstatic.com") {
    event.respondWith(cacheFirst(request, FONTS, MAX_FONTS));
    return;
  }
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    if (neverSave(url.pathname)) {
      event.respondWith(networkOrOffline(event));
      return;
    }
    event.respondWith(page(event, url));
    return;
  }

  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirst(request, ASSETS, MAX_ASSETS));
  }
});

function neverSave(path) {
  return NEVER_SAVE.some((p) =>
    p.endsWith("/") ? path.startsWith(p) : path === p || path.startsWith(p + "/"),
  );
}

async function cacheFirst(request, cacheName, max) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  // Opaque responses are skipped: the browser pads them to megabytes of quota.
  if (res.ok && res.type !== "opaque") {
    await cache.put(request, res.clone());
    trim(cache, max);
  }
  return res;
}

async function page(event, url) {
  const cache = await caches.open(PAGES);
  const key = url.origin + url.pathname + url.search;
  const network = (async () => {
    const preloaded = await event.preloadResponse;
    const res = preloaded || (await fetch(event.request));
    if (res.ok && !res.redirected && isHtml(res)) {
      await cache.put(key, res.clone());
      trim(cache, MAX_PAGES);
    }
    return res;
  })();
  event.waitUntil(network.catch(() => {}));

  const saved = await cache.match(key);
  if (!saved) {
    try {
      return await network;
    } catch {
      return offlinePage();
    }
  }
  // Network first; the saved copy only if it fails or takes too long.
  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), NAV_TIMEOUT_MS));
  try {
    const res = await Promise.race([network, timeout]);
    return res || saved;
  } catch {
    return saved;
  }
}

async function networkOrOffline(event) {
  try {
    const preloaded = await event.preloadResponse;
    return preloaded || (await fetch(event.request));
  } catch {
    return offlinePage();
  }
}

function isHtml(res) {
  return (res.headers.get("content-type") || "").includes("text/html");
}

async function prime(urls) {
  const cache = await caches.open(ASSETS);
  const wanted = urls
    .filter((u) => {
      try {
        const url = new URL(u);
        return url.origin === self.location.origin && url.pathname.startsWith("/assets/");
      } catch {
        return false;
      }
    })
    .slice(0, 150);
  for (const u of wanted) {
    if (await cache.match(u)) continue;
    try {
      const res = await fetch(u);
      if (res.ok) await cache.put(u, res);
    } catch {
      // Offline or gone: it'll be saved the next time it's used.
    }
  }
  trim(cache, MAX_ASSETS);
}

// Oldest first: Cache Storage keeps insertion order.
async function trim(cache, max) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

function offlinePage() {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Offline · Oakmonte</title><style>html,body{height:100%;margin:0}body{display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,sans-serif;background:#fff;color:#111827;padding:24px;box-sizing:border-box;text-align:center}h1{font-size:20px;margin:0 0 8px}p{margin:0 0 20px;color:#667085;font-size:15px;line-height:1.5}button{border:0;border-radius:999px;background:#111827;color:#fff;font:600 15px system-ui;padding:13px 26px}</style></head><body><div><h1>You're offline</h1><p>This page hasn't been saved on your phone yet.<br>Connect to the internet and try again.</p><button onclick="location.reload()">Try again</button></div></body></html>`;
  return new Response(html, {
    status: 503,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
