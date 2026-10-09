// Oakmonte's service worker. It exists for ONE feature: opening Offline videos
// when there is no connection at all (a cold launch of the installed app on a
// plane, say). Without it the browser shows its own "no internet" page before
// any of our code runs, and the posts saved in Cache Storage are unreachable.
//
// Registered only by src/lib/offline-videos.ts -- after someone saves a post
// for offline viewing, or opens /offline-videos. Nobody who never uses the
// feature ever gets it.
//
// It deliberately does as little as possible while online:
//   - page loads go to the network exactly as before (navigation preload, so
//     there's no extra wait for this worker to boot); only when that FAILS
//     does it answer, with the saved Offline videos page or a small offline
//     notice.
//   - /assets/* (content-hashed, immutable) are served from the shell cache
//     when present -- always correct, since a changed file gets a new name --
//     and from the network otherwise.
//   - everything else (API calls, Supabase, media, other origins) is never
//     touched.
//
// The media itself is not this worker's job: the page reads it straight out
// of the `oak-offline-v1` cache with the Cache API.
//
// KILL SWITCH. If this ever misbehaves in production, replace this whole file
// with:
//     self.addEventListener("install", () => self.skipWaiting());
//     self.addEventListener("activate", () => self.registration.unregister());
// Browsers re-check this script on navigation (and at least daily), so every
// installed copy removes itself on its next visit.

const SHELL_CACHE = "oak-shell-v1";
const SHELL_PATH = "/offline-videos";
const PRIME_MESSAGE = "oak-prime-offline-shell";
// Upper bound on what one prime will store, so a long browsing session
// reported by the page can't turn into hundreds of cached chunks.
const MAX_SHELL_ASSETS = 120;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    // Server routes and the auth callback answer navigations with redirects
    // and cookies; nothing about them can work offline anyway, so they are
    // left entirely to the browser.
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;
    event.respondWith(navigate(event, url));
    return;
  }

  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(asset(request));
  }
});

async function navigate(event, url) {
  try {
    const preloaded = await event.preloadResponse;
    if (preloaded) return preloaded;
    return await fetch(event.request);
  } catch {
    return offlineResponse(url);
  }
}

async function asset(request) {
  const hit = await caches.match(request, { cacheName: SHELL_CACHE });
  return hit ?? fetch(request);
}

async function offlineResponse(url) {
  let shell;
  try {
    const cache = await caches.open(SHELL_CACHE);
    shell = await cache.match(SHELL_PATH);
  } catch {
    shell = undefined;
  }
  if (shell && url.pathname === SHELL_PATH) return shell;
  return new Response(offlinePage(Boolean(shell)), {
    status: 503,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

// Self-contained: no stylesheet, script or font from the network, since there
// isn't one. Follows the phone's light/dark setting like the social screens.
function offlinePage(hasShell) {
  const watch = hasShell ? `<a class="primary" href="${SHELL_PATH}">Watch offline videos</a>` : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<title>You're offline — Oakmonte</title>
<style>
  :root { --bg: #000; --text: #fff; --muted: rgba(255,255,255,.55); --soft: #2a2d33; }
  @media (prefers-color-scheme: light) {
    :root { --bg: #fff; --text: #0a0a0a; --muted: rgba(10,10,10,.52); --soft: #eff0f3; }
  }
  html, body { margin: 0; height: 100%; background: var(--bg); color: var(--text);
    font-family: system-ui, -apple-system, "SF Pro", sans-serif; }
  main { min-height: 100%; box-sizing: border-box; display: flex; flex-direction: column;
    align-items: center; justify-content: center; text-align: center;
    padding: calc(env(safe-area-inset-top) + 24px) 24px calc(env(safe-area-inset-bottom) + 24px); }
  h1 { font-size: 20px; margin: 0 0 8px; }
  p { font-size: 15px; line-height: 1.4; color: var(--muted); margin: 0 0 24px; max-width: 300px; }
  a, button { display: block; width: 100%; max-width: 280px; height: 46px; line-height: 46px;
    border-radius: 999px; font: 600 15px system-ui, -apple-system, sans-serif;
    text-decoration: none; border: 0; margin-top: 10px; cursor: pointer; }
  .primary { background: var(--text); color: var(--bg); }
  button { background: var(--soft); color: var(--text); }
</style>
</head>
<body>
<main>
  <h1>You're offline</h1>
  <p>${
    hasShell
      ? "Oakmonte needs a connection for this page. Posts you saved for offline still play."
      : "Oakmonte needs a connection for this page. Check your connection and try again."
  }</p>
  ${watch}
  <button type="button" onclick="location.reload()">Try again</button>
</main>
</body>
</html>`;
}

// The page asks for this after a save and whenever /offline-videos is opened
// online: fetch the CURRENT Offline videos page and every asset it needs, and
// only once all of them have arrived replace the previous shell. A failed or
// partial prime leaves the old (still self-consistent) shell in place.
self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== PRIME_MESSAGE) return;
  const extra = Array.isArray(data.assets) ? data.assets : [];
  event.waitUntil(prime(extra).catch(() => {}));
});

async function prime(extra) {
  const page = await fetch(SHELL_PATH, { credentials: "same-origin", cache: "no-store" });
  if (!page.ok) return;
  const html = await page.clone().text();

  const assets = new Set();
  for (const match of html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+\.(?:js|css))"/g)) {
    assets.add(match[1]);
  }
  // What the page actually loaded, for anything the HTML doesn't name (a
  // chunk the root pulls in lazily).
  for (const path of extra) {
    if (typeof path === "string" && /^\/assets\/[^?#]+\.(?:js|css)$/.test(path)) assets.add(path);
  }
  const list = [...assets].slice(0, MAX_SHELL_ASSETS);

  const fetched = await Promise.all(
    list.map(async (path) => {
      const res = await fetch(path, { credentials: "same-origin" });
      if (!res.ok) throw new Error(`prime: ${path} ${res.status}`);
      return [path, res];
    }),
  );

  await caches.delete(SHELL_CACHE);
  const cache = await caches.open(SHELL_CACHE);
  await cache.put(SHELL_PATH, page);
  await Promise.all(fetched.map(([path, res]) => cache.put(path, res)));
}
