// Store subdomains: reazy.oakmonte.store is the reazy storefront, the same page
// as oakmonte.store/shop/reazy.
//
// Two halves, both dormant until the wildcard domain (*.oakmonte.store) is
// added in Vercel -- no subdomain reaches the app before that:
//
//   - The router's `rewrite` (router.tsx) maps the subdomain's "/" onto
//     /shop/<store> on the way in, and back to "/" on the way out, on the
//     server and in the browser alike, so the address bar stays
//     reazy.oakmonte.store. Every other path (/cart, /checkout/..., /order/...,
//     /api/..., /assets/...) works unchanged on the subdomain.
//   - storefrontUrl() hands out the subdomain address only once
//     VITE_STORE_SUBDOMAINS=true, so no seller is given a link that doesn't
//     resolve yet. Flip it the day the wildcard domain is live.
//
// Worth knowing before switching on: each subdomain is its own origin, so a
// sign-in, cart or service worker on oakmonte.store isn't shared with
// reazy.oakmonte.store (Supabase keeps its session in localStorage, per origin).
// Buyers on a storefront already use their own buyer session, so that's fine
// for shopping; Supabase's auth Redirect URLs also need https://*.oakmonte.store/**.

export const ROOT_DOMAIN = "oakmonte.store";

/** Subdomains that are never a store: Oakmonte's own hosts. */
const RESERVED = new Set([
  "www",
  "app",
  "api",
  "cdn",
  "admin",
  "mail",
  "email",
  "staging",
  "test",
  "dev",
  "help",
  "support",
  "blog",
  "status",
  "shop",
  "store",
]);

/** A store handle as store_username allows it: lowercase letters, digits, dashes. */
const HANDLE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** The store a hostname belongs to, or null. reazy.oakmonte.store -> "reazy".
 *  reazy.localhost works too, for trying it in development. */
export function storeFromHost(hostname: string): string | null {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  for (const root of [ROOT_DOMAIN, "localhost"]) {
    if (!host.endsWith(`.${root}`)) continue;
    const sub = host.slice(0, -(root.length + 1));
    if (sub.includes(".") || RESERVED.has(sub) || !HANDLE.test(sub)) return null;
    return sub;
  }
  return null;
}

/** Router rewrite, in: a store subdomain's home is that store's page. */
export function rewriteStoreHostIn(url: URL): URL | undefined {
  const store = storeFromHost(url.hostname);
  if (!store || url.pathname !== "/") return undefined;
  const next = new URL(url.href);
  next.pathname = `/shop/${store}`;
  return next;
}

/** Router rewrite, out: on a store subdomain, that store's page shows as "/". */
export function rewriteStoreHostOut(url: URL): URL | undefined {
  const store = storeFromHost(url.hostname);
  if (!store || url.pathname !== `/shop/${store}`) return undefined;
  const next = new URL(url.href);
  next.pathname = "/";
  return next;
}

/** Whether store links use subdomains yet (VITE_STORE_SUBDOMAINS=true). */
export const STORE_SUBDOMAINS = import.meta.env.VITE_STORE_SUBDOMAINS === "true";

/** The public address of a store, to show or share. */
export function storefrontUrl(username: string, origin = `https://${ROOT_DOMAIN}`): string {
  return STORE_SUBDOMAINS
    ? `https://${username}.${ROOT_DOMAIN}`
    : `${origin}/shop/${encodeURIComponent(username)}`;
}

/** The same address without the scheme, for display ("reazy.oakmonte.store"). */
export function storefrontLabel(username: string): string {
  return STORE_SUBDOMAINS ? `${username}.${ROOT_DOMAIN}` : `${ROOT_DOMAIN}/shop/${username}`;
}
