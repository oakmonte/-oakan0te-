import { createFileRoute } from "@tanstack/react-router";
import { getRequestUser } from "@/lib/server-auth";

// Validates a buyer's delivery address through Shipbubble and returns the
// address_code the rates call needs. Authenticated: it spends the project's
// Shipbubble key on the caller's behalf, and the vendor's error body is
// account state, so it is logged rather than echoed.
const NO_STORE = { "Cache-Control": "no-store, private", Vary: "Authorization" } as const;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: NO_STORE });
}

export const Route = createFileRoute("/api/shipping/address")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const user = await getRequestUser(request);
        if (!user) return json({ error: "Not signed in" }, 401);

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
        if (!user.email) return json({ error: "Your account has no email." }, 400);

        const res = await fetch("https://api.shipbubble.com/v1/shipping/address/validate", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.SHIPBUBBLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            email: user.email,
            phone,
            address,
            ...(lat !== null && lng !== null ? { latitude: lat, longitude: lng } : {}),
          }),
        });
        const payload = (await res.json().catch(() => null)) as {
          data?: Record<string, unknown>;
          message?: string;
        } | null;
        if (!res.ok || !payload?.data) {
          console.error("Shipbubble address validate failed:", res.status, payload);
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
