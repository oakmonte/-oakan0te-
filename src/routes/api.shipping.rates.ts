import { createFileRoute } from "@tanstack/react-router";
import { fetchRates, ShippingError } from "@/lib/shipping.server";
import { itemsTotalKobo, parseOrderLines } from "@/lib/order-lines";

// Live courier prices for one product, or one store's lines from the bag, to a
// validated buyer address. Open to guests (guest checkout), so it is
// rate-limited per IP. Price, weight and the seller's pickup address come from
// the database: the client only says which products/variants, how many, and
// which validated address_code.
const NO_STORE = { "Cache-Control": "no-store, private" } as const;

const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 12;
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: NO_STORE });
}

export const Route = createFileRoute("/api/shipping/rates")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
        if (limited(ip)) return json({ error: "Too many tries. Wait a minute." }, 429);

        const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        const parsed = body ? parseOrderLines(body) : null;
        const addressCode = Number(body?.addressCode);
        if (!parsed || !Number.isFinite(addressCode)) return json({ error: "Bad request" }, 400);
        if (!parsed.ok) return json({ error: parsed.error }, 400);

        try {
          const { items, requestToken, couriers } = await fetchRates({
            lines: parsed.lines,
            legacy: parsed.legacy,
            addressCode,
          });
          // The items figure the order will be charged, so the checkout page
          // can show the server's number rather than its own sum.
          return json({ requestToken, couriers, itemsTotalKobo: itemsTotalKobo(items) });
        } catch (err) {
          if (err instanceof ShippingError && err.status !== 502) {
            return json({ error: err.message }, err.status);
          }
          console.error("rates failed", err);
          return json({ error: "Couldn't get delivery prices. Try again in a moment." }, 502);
        }
      },
    },
  },
});
