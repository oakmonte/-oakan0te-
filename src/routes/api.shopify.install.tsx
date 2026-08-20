import { createFileRoute } from "@tanstack/react-router";
import { requireStoreOwner } from "@/lib/server-auth";

// Step 1 of the Shopify connect flow: hand the caller the authorize URL.
//
// SECURITY — why this is a POST and not a redirecting GET:
// it used to be an unauthenticated GET that took `storeId` off the query
// string and HMAC-signed it into `state`. The callback then treated that
// signature as proof of ownership, but a signature only proves the server
// signed it — never who asked. Anyone could mint a valid `state` for any store
// id (and `stores` has RLS off, so every id is readable), then complete the
// install against a store they do not own.
//
// Requiring a session and checking ownership here removes that. A POST is used
// because the browser cannot attach an Authorization header to a top-level
// navigation — the client posts, then navigates to the returned `url`.
//
// STILL OPEN: `state` carries no per-session nonce, so it does not prove the
// browser finishing the callback is the one that started it. An attacker with
// their own store can still mint a URL for THEIR store and phish a victim into
// authorising, landing the victim's Shopify token under the attacker's store.
// Closing that needs a single-use nonce persisted against (user_id, store_id)
// plus an httpOnly cookie the callback checks. See the security notes.
const SHOP_DOMAIN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i;

export const Route = createFileRoute("/api/shopify/install")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        let body: { shop?: string; storeId?: string };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid request body" }, { status: 400 });
        }

        const shop = body.shop?.trim().toLowerCase();
        if (!shop || !SHOP_DOMAIN.test(shop)) {
          // The old check was `shop.endsWith(".myshopify.com")`, which a value
          // like "evil.com#x.myshopify.com" satisfies — the browser would then
          // be redirected to evil.com with everything after # as a fragment.
          return Response.json({ error: "invalid shop domain" }, { status: 400 });
        }

        const owns = await requireStoreOwner(request, body.storeId ?? null);
        if (!owns.ok) return owns.response;
        const storeId = owns.value.storeId;

        const secret = process.env.SHOPIFY_API_SECRET;
        const clientId = process.env.SHOPIFY_API_KEY;
        const scopes = process.env.SHOPIFY_SCOPES;
        const redirectUri = process.env.SHOPIFY_REDIRECT_URI;
        if (!secret || !clientId || !scopes || !redirectUri) {
          console.error("Shopify install: missing SHOPIFY_* environment configuration");
          return Response.json({ error: "Shopify is not configured" }, { status: 500 });
        }

        // sign storeId into state so we don't need a DB table to verify it on callback
        const key = await crypto.subtle.importKey(
          "raw",
          new TextEncoder().encode(secret),
          { name: "HMAC", hash: "SHA-256" },
          false,
          ["sign"],
        );
        const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(storeId));
        const sigHex = Array.from(new Uint8Array(sig))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        const state = `${storeId}.${sigHex}`;

        const params = new URLSearchParams({
          client_id: clientId,
          scope: scopes,
          redirect_uri: redirectUri,
          state,
        });

        return Response.json({ url: `https://${shop}/admin/oauth/authorize?${params}` });
      },
    },
  },
});
