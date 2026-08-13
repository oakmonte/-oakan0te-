import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/shopify/install")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const shop = url.searchParams.get("shop");
        const storeId = url.searchParams.get("storeId");

        if (!shop || !storeId) {
          return Response.json({ error: "shop and storeId required" }, { status: 400 });
        }

        if (!shop.endsWith(".myshopify.com")) {
          return Response.json({ error: "invalid shop domain" }, { status: 400 });
        }

        // sign storeId into state so we don't need a DB table to verify it on callback
        const secret = process.env.SHOPIFY_API_SECRET!;
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
          client_id: process.env.SHOPIFY_API_KEY!,
          scope: process.env.SHOPIFY_SCOPES!,
          redirect_uri: process.env.SHOPIFY_REDIRECT_URI!,
          state,
        });

        return Response.redirect(`https://${shop}/admin/oauth/authorize?${params.toString()}`, 302);
      },
    },
  },
});
