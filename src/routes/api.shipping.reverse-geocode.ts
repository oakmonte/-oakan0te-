import { createFileRoute } from "@tanstack/react-router";
import { getRequestUser } from "@/lib/server-auth";

// "Use my current location" at checkout: turns coordinates into a readable
// address. Server-side so the browser never calls Nominatim itself (their
// policy wants an identifying User-Agent, which browsers won't let us set).
// Free tier, one lookup per tap, signed-in callers only.
const NO_STORE = { "Cache-Control": "no-store, private", Vary: "Authorization" } as const;

// Open to guests (guest checkout); per-caller window so it cannot be looped.
const hits = new Map<string, number[]>();
function limited(key: string) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > 10;
}

export const Route = createFileRoute("/api/shipping/reverse-geocode")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const user = await getRequestUser(request);
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
        if (limited(user?.id ?? ip)) {
          return Response.json({ error: "Too many tries" }, { status: 429 });
        }

        const body = (await request.json().catch(() => null)) as {
          lat?: unknown;
          lng?: unknown;
        } | null;
        const lat = Number(body?.lat);
        const lng = Number(body?.lng);
        if (
          !Number.isFinite(lat) ||
          !Number.isFinite(lng) ||
          Math.abs(lat) > 90 ||
          Math.abs(lng) > 180
        ) {
          return Response.json({ error: "Bad coordinates" }, { status: 400 });
        }

        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&lat=${lat}&lon=${lng}`,
          {
            headers: {
              Accept: "application/json",
              "User-Agent": "Oakmonte/1.0 (https://oakmonte.store)",
            },
          },
        );
        if (!res.ok) return Response.json({ address: null }, { headers: NO_STORE });
        const data = (await res.json()) as { display_name?: string };
        return Response.json({ address: data.display_name ?? null }, { headers: NO_STORE });
      },
    },
  },
});
