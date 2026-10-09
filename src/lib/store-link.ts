// The public link a seller shares for their store.
//
// The path form, not `<username>.oakmonte.store`: per-store subdomains need
// host routing and a wildcard domain that do not exist yet (LOCKED-ROUTES.md,
// "Platform"), so a subdomain link would be a dead link in a buyer's WhatsApp.
// The canonical origin is spelled out rather than read from window.location so
// a link copied from a Vercel preview still points buyers at production.
export const PUBLIC_ORIGIN = "https://oakmonte.store";

export function storeLink(storeUsername: string): string {
  return `${PUBLIC_ORIGIN}/store-profile/${encodeURIComponent(storeUsername)}`;
}

/** The link without its scheme, for display where space is tight. */
export function storeLinkLabel(storeUsername: string): string {
  return storeLink(storeUsername).replace(/^https:\/\//, "");
}
