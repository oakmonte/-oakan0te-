import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin as supabase } from "@/lib/integrations/my-supabase/client.server";
import { encryptField, fieldContext } from "@/lib/field-encryption.server";

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

export const Route = createFileRoute("/api/shopify/callback")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const params = url.searchParams;
        const shop = params.get("shop");
        const code = params.get("code");
        const hmac = params.get("hmac");
        const state = params.get("state");

        if (!shop || !code || !hmac || !state) {
          return Response.json({ error: "missing required params" }, { status: 400 });
        }

        // verify Shopify's HMAC on the callback itself
        const secret = process.env.SHOPIFY_API_SECRET!;
        const message = Array.from(params.entries())
          .filter(([k]) => k !== "hmac")
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => `${k}=${v}`)
          .join("&");

        const expectedHmac = await hmacHex(secret, message);
        if (expectedHmac !== hmac) {
          return Response.json({ error: "HMAC validation failed" }, { status: 401 });
        }

        // verify state matches the storeId we signed in /install
        const [storeId, providedSig] = state.split(".");
        if (!storeId || !providedSig) {
          return Response.json({ error: "invalid state" }, { status: 400 });
        }
        const expectedSig = await hmacHex(secret, storeId);
        if (expectedSig !== providedSig) {
          return Response.json({ error: "state verification failed" }, { status: 401 });
        }

        // exchange code for access token
        const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: process.env.SHOPIFY_API_KEY,
            client_secret: process.env.SHOPIFY_API_SECRET,
            code,
          }),
        });

        if (!tokenRes.ok) {
          const body = await tokenRes.text();
          console.error("Shopify token exchange failed:", tokenRes.status, body);
          return Response.json({ error: "token exchange failed" }, { status: 400 });
        }

        const { access_token, scope } = await tokenRes.json();

        // Stored encrypted; the import worker decrypts it with the same
        // fieldContext. No key configured means no connection, not a
        // plaintext token.
        let sealedToken: string;
        try {
          sealedToken = await encryptField(access_token, fieldContext.shopifyAccessToken(storeId));
        } catch (err) {
          console.error("Shopify callback: could not encrypt token", err);
          return Response.json({ error: "could not save the connection" }, { status: 500 });
        }

        const { error } = await supabase.from("store_credentials").upsert(
          {
            store_id: storeId,
            shopify_shop_domain: shop,
            shopify_access_token: sealedToken,
            shopify_connected_at: new Date().toISOString(),
            shopify_scopes: scope,
          },
          { onConflict: "store_id" },
        );

        if (error) {
          console.error("Shopify callback: could not save credentials", error);
          return Response.json({ error: "could not save the connection" }, { status: 500 });
        }

        return Response.redirect("https://oakmonte.store/store?shopify=connected", 302);
      },
    },
  },
});
