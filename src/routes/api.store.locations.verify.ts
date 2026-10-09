import { createFileRoute } from "@tanstack/react-router";
import { getRequestUser } from "@/lib/server-auth";
import { supabaseAdmin } from "@/lib/integrations/my-supabase/client.server";
import { shipbubbleName } from "@/lib/shipping.server";

// Checks a seller's pickup address with Shipbubble before it's saved, so a
// buyer never meets "delivery can't be priced" because the seller's address
// was one couriers can't find. Same validate call checkout makes for the
// sender (shipping.server.ts fetchRates); doing it here moves the failure to
// the one person who can fix it.
//
// Spends the project's Shipbubble key, so: signed-in owners of the store only,
// and the vendor's error body is logged, not echoed.

const NO_STORE = { "Cache-Control": "no-store, private", Vary: "Authorization" } as const;
function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: NO_STORE });
}

const hits = new Map<string, number[]>();
function limited(key: string) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > 10;
}

export const Route = createFileRoute("/api/store/locations/verify")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const user = await getRequestUser(request);
        if (!user) return json({ error: "Sign in again." }, 401);
        if (limited(user.id)) return json({ error: "Too many tries. Wait a minute." }, 429);

        let body: Record<string, unknown>;
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return json({ error: "Bad request" }, 400);
        }
        const storeId = typeof body.storeId === "string" ? body.storeId : "";
        const address = typeof body.address === "string" ? body.address.trim() : "";
        const loose = typeof body.looseAddress === "string" ? body.looseAddress.trim() : "";
        const lat = typeof body.lat === "number" && Number.isFinite(body.lat) ? body.lat : null;
        const lng = typeof body.lng === "number" && Number.isFinite(body.lng) ? body.lng : null;
        if (!storeId || address.length < 8 || address.length > 300) {
          return json({ error: "Add the street, city, state and country." }, 400);
        }

        const { data: store } = await supabaseAdmin
          .from("stores")
          .select("owner_id, brand_name, business_email, business_phone")
          .eq("id", storeId)
          .maybeSingle();
        if (!store || store.owner_id !== user.id) return json({ error: "Not your store." }, 403);

        async function validate(text: string) {
          const r = await fetch("https://api.shipbubble.com/v1/shipping/address/validate", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.SHIPBUBBLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: shipbubbleName(store!.brand_name),
              email: store!.business_email ?? user!.email ?? "orders@oakmonte.store",
              phone: store!.business_phone ?? "08000000000",
              address: text,
              ...(lat !== null && lng !== null ? { latitude: lat, longitude: lng } : {}),
            }),
          });
          const payload = (await r.json().catch(() => null)) as {
            data?: Record<string, unknown>;
          } | null;
          return { res: r, payload };
        }

        // Landmarks and postal codes trip Shipbubble up on addresses it would
        // otherwise find, so a miss on the full text retries with street,
        // city, state and country only -- the same fallback checkout uses.
        let { res, payload } = await validate(address);
        if (res.status === 400 && loose && loose !== address && loose.length >= 8) {
          ({ res, payload } = await validate(loose));
        }
        if (!res.ok || !payload?.data) {
          console.error("Shipbubble location validate failed:", res.status, payload);
          if (res.status === 401 || res.status === 403 || res.status >= 500) {
            // Our key, quota or their outage -- not the seller's address.
            return json({ unavailable: true }, 503);
          }
          return json(
            {
              error:
                "Shipbubble couldn't find this address. Check the street and city, or use your current location.",
            },
            422,
          );
        }
        const d = payload.data;
        return json({
          formattedAddress:
            typeof d.formatted_address === "string" && d.formatted_address
              ? d.formatted_address
              : address,
          lat: typeof d.latitude === "number" ? d.latitude : null,
          lng: typeof d.longitude === "number" ? d.longitude : null,
        });
      },
    },
  },
});
