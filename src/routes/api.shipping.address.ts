import { createFileRoute } from "@tanstack/react-router";
import { getRequestUser } from "@/lib/server-auth";

// Validates a buyer's delivery address through Shipbubble and returns the
// address_code the rates call needs. It spends the project's
// Shipbubble key on the caller's behalf, and the vendor's error body is
// account state, so it is logged rather than echoed.
// Guests can check out, so this is open to anonymous callers. The cost is that
// anyone can spend Shipbubble calls through it; a small per-IP window keeps a
// loop from burning the quota. In-memory, so it is per-instance: a speed bump,
// not a guarantee.
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 12;
}

const NO_STORE = { "Cache-Control": "no-store, private", Vary: "Authorization" } as const;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: NO_STORE });
}

export const Route = createFileRoute("/api/shipping/address")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const user = await getRequestUser(request);
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
        if (limited(user?.id ?? ip)) return json({ error: "Too many tries. Wait a minute." }, 429);

        let body: Record<string, unknown>;
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return json({ error: "Bad request" }, 400);
        }
        const name = typeof body.name === "string" ? body.name.trim() : "";
        const phone = typeof body.phone === "string" ? body.phone.trim() : "";
        const address = typeof body.address === "string" ? body.address.trim() : "";
        const lat = typeof body.lat === "number" && Number.isFinite(body.lat) ? body.lat : null;
        const lng = typeof body.lng === "number" && Number.isFinite(body.lng) ? body.lng : null;
        if (!name || !phone || address.length < 8 || address.length > 300) {
          return json({ error: "Add your name, phone number and full address." }, 400);
        }
        const typedEmail = typeof body.email === "string" ? body.email.trim() : "";
        // Email is optional for buyers; Shipbubble insists on one, so a blank
        // falls back to Oakmonte's orders inbox. A typed one must be valid.
        if (typedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(typedEmail)) {
          return json({ error: "That email doesn't look right." }, 400);
        }
        const email = user?.email ?? (typedEmail || "orders@oakmonte.store");

        // A wrong postal code or a long landmark tail ("off ... LCDA") makes
        // Shipbubble reject an address it would otherwise find, so when the full
        // text fails, try once more with street, city, state and country only.
        const loose = typeof body.looseAddress === "string" ? body.looseAddress.trim() : "";
        async function validate(text: string) {
          const r = await fetch("https://api.shipbubble.com/v1/shipping/address/validate", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.SHIPBUBBLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name,
              email,
              phone,
              address: text,
              ...(lat !== null && lng !== null ? { latitude: lat, longitude: lng } : {}),
            }),
          });
          const pl = (await r.json().catch(() => null)) as {
            data?: Record<string, unknown>;
            message?: string;
          } | null;
          return { res: r, payload: pl };
        }
        let { res, payload } = await validate(address);
        if (res.status === 400 && loose && loose !== address && loose.length >= 8) {
          ({ res, payload } = await validate(loose));
        }
        if (!res.ok || !payload?.data) {
          console.error("Shipbubble address validate failed:", res.status, payload);
          // 401/403/5xx are OUR problem (key, quota, outage), not the buyer's
          // address; blaming the address sends them rewriting a good one.
          if (res.status === 401 || res.status === 403 || res.status >= 500) {
            return json(
              { error: "Address checking is unavailable right now. Try again soon." },
              503,
            );
          }
          return json(
            { error: "We couldn't find that address. Add the street, area and city." },
            422,
          );
        }
        const d = payload.data;
        return json({
          addressCode: d.address_code,
          formattedAddress: d.formatted_address ?? address,
          lat: d.latitude ?? lat,
          lng: d.longitude ?? lng,
          postalCode: d.postal_code ?? null,
        });
      },
    },
  },
});
