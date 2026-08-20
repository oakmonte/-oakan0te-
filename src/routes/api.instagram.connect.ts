import { createFileRoute } from "@tanstack/react-router";
import { requireStoreOwner } from "@/lib/server-auth";

/**
 * Step 1 of the Instagram connect flow: redirect the seller to Instagram.
 *
 * This lives here rather than in the import worker for the same reason the
 * Shopify routes do — it is two fast HTTP calls next to a session, and Render
 * is a background worker with no public URL. The worker only picks up the slow
 * media pull afterwards, via import_jobs.
 *
 * State is the storeId signed with an HMAC, exactly as api.shopify.install does
 * it, so the callback can trust the storeId without a round trip to a table of
 * pending OAuth attempts. The signature is what stops someone pointing a
 * callback at another seller's store.
 */
async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const Route = createFileRoute("/api/instagram/connect")({
  server: {
    handlers: {
      // POST, not a redirecting GET: this used to be unauthenticated, taking
      // `storeId` off the query string and signing it into `state`. The
      // callback treated that signature as proof of ownership, but it only
      // proves the server signed it, never who asked — so anyone could mint a
      // valid state for any store id. A browser cannot attach an Authorization
      // header to a top-level navigation, so the client posts here and then
      // navigates to the returned `url`.
      //
      // STILL OPEN: `state` has no per-session nonce, so it cannot prove the
      // browser completing the callback is the one that started it. See the
      // matching note in api.shopify.install.tsx.
      POST: async ({ request }: { request: Request }) => {
        let body: { storeId?: string };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid request body" }, { status: 400 });
        }

        const owns = await requireStoreOwner(request, body.storeId ?? null);
        if (!owns.ok) return owns.response;
        const storeId = owns.value.storeId;

        const appId = process.env.IG_APP_ID;
        const redirectUri = process.env.IG_REDIRECT_URI;
        const secret = process.env.IG_APP_SECRET;

        if (!appId || !redirectUri || !secret) {
          console.error("Instagram connect: missing IG_APP_ID / IG_REDIRECT_URI / IG_APP_SECRET");
          return Response.json({ error: "Instagram is not configured" }, { status: 500 });
        }

        const state = `${storeId}.${await hmacHex(secret, storeId)}`;

        const params = new URLSearchParams({
          client_id: appId,
          redirect_uri: redirectUri,
          response_type: "code",
          // Read-only access to the seller's own media. Nothing here posts,
          // and nothing here needs to.
          scope: "instagram_business_basic",
          state,
        });

        return Response.json({
          url: `https://www.instagram.com/oauth/authorize?${params.toString()}`,
        });
      },
    },
  },
});
