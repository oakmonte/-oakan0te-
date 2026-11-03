// Everything a public storefront's first screen needs, in one response.
//
//   GET /api/storefront/<handle>
//   → StorefrontData (lib/storefront-data.ts), or 404 { store: null }
//
// The page itself gets this rendered into its HTML on a direct visit (the
// /shop/$storeUsername loader calls loadStorefrontData on the server); this
// route is what that loader fetches on an in-app navigation, so both paths
// are one request. Public data with anon-key reads only, so it's cached at
// the edge -- the second Nigerian visitor in a minute never reaches Ireland.

import { createFileRoute } from "@tanstack/react-router";
import { STOREFRONT_CACHE_CONTROL, loadStorefrontData } from "@/lib/storefront-data";

export const Route = createFileRoute("/api/storefront/$handle")({
  server: {
    handlers: {
      GET: async ({ params }: { params: { handle: string } }) => {
        try {
          const data = await loadStorefrontData(params.handle);
          return Response.json(data ?? { store: null }, {
            status: data ? 200 : 404,
            headers: { "Cache-Control": STOREFRONT_CACHE_CONTROL },
          });
        } catch (error) {
          console.error("api/storefront:", error);
          return Response.json(
            { error: "Couldn't load this store" },
            { status: 500, headers: { "Cache-Control": "no-store" } },
          );
        }
      },
    },
  },
});
