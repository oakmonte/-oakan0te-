import { createFileRoute } from "@tanstack/react-router";

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
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const storeId = url.searchParams.get("storeId");

        if (!storeId) {
          return Response.json({ error: "storeId required" }, { status: 400 });
        }

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

        return Response.redirect(
          `https://www.instagram.com/oauth/authorize?${params.toString()}`,
          302,
        );
      },
    },
  },
});
