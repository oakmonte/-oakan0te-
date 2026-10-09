import { createFileRoute } from "@tanstack/react-router";
import { getRequestUser } from "@/lib/server-auth";
import { autocomplete, placeAddress, placesLimited } from "@/lib/places.server";

// POST { input, sessionToken, regionCode? }  -> { suggestions }
// POST { placeId, sessionToken }             -> { address }
// Open to guests (guest checkout), limited per caller. See places.server.ts.
const NO_STORE = { "Cache-Control": "no-store, private", Vary: "Authorization" } as const;

export const Route = createFileRoute("/api/places/autocomplete")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const user = await getRequestUser(request);
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
        if (placesLimited(user?.id ?? ip)) {
          return Response.json({ suggestions: [] }, { status: 429, headers: NO_STORE });
        }
        const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        const sessionToken =
          typeof body?.sessionToken === "string" ? body.sessionToken.slice(0, 64) : "";
        if (!sessionToken) return Response.json({ error: "Bad request" }, { status: 400 });

        if (typeof body?.placeId === "string") {
          const address = await placeAddress(body.placeId, sessionToken).catch(() => null);
          return Response.json({ address }, { headers: NO_STORE });
        }
        const input = typeof body?.input === "string" ? body.input.slice(0, 200) : "";
        const region =
          typeof body?.regionCode === "string" && /^[A-Za-z]{2}$/.test(body.regionCode)
            ? body.regionCode
            : null;
        const suggestions = await autocomplete(input, sessionToken, region).catch(() => []);
        return Response.json({ suggestions }, { headers: NO_STORE });
      },
    },
  },
});
