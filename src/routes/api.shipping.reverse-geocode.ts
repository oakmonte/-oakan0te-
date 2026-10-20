import { createFileRoute } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRequestUser } from "@/lib/server-auth";
import { reverseGeocodeGoogle } from "@/lib/places.server";
import { supabaseAdmin } from "@/lib/integrations/my-supabase/client.server";

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

async function osmPostcode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&lat=${lat}&lon=${lng}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "Oakmonte/1.0 (https://oakmonte.store)",
        },
        signal: AbortSignal.timeout(2500),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { address?: { postcode?: string } };
    return data.address?.postcode || null;
  } catch {
    return null;
  }
}

type Geocoded = {
  address: string | null;
  line1: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
};

// Remembered lookups (geocode_cache): 4 decimals is a ~11 m square, close
// enough that the street and postal code don't change. Google's terms cap
// storage at 30 days, so older rows are treated as missing and overwritten.
// Not in the generated types yet, hence the loose client.
const CACHE_DAYS = 30;
const cacheKey = (lat: number, lng: number) => `${lat.toFixed(4)},${lng.toFixed(4)}`;
const cacheTable = () => (supabaseAdmin as unknown as SupabaseClient).from("geocode_cache");

async function cached(key: string): Promise<Geocoded | null> {
  const since = new Date(Date.now() - CACHE_DAYS * 86_400_000).toISOString();
  const { data } = await cacheTable()
    .select("result")
    .eq("key", key)
    .gte("created_at", since)
    .maybeSingle()
    .then(
      (r) => r,
      () => ({ data: null }),
    );
  return (data?.result as Geocoded | undefined) ?? null;
}

async function remember(key: string, result: Geocoded) {
  // A failed write only costs the next tap a fresh lookup.
  await cacheTable()
    .upsert({ key, result, created_at: new Date().toISOString() })
    .then(
      ({ error }) => error && console.error("geocode cache write:", error.message),
      () => {},
    );
}

async function lookup(lat: number, lng: number): Promise<Geocoded | null> {
  // Google first (much better on Nigerian streets); the free
  // OpenStreetMap lookup below stays as the fallback.
  const google = await reverseGeocodeGoogle(lat, lng).catch(() => null);
  if (google) {
    // Google often has no postal code for the pin; OpenStreetMap
    // sometimes does, so ask it for just that before giving up.
    if (!google.postalCode) google.postalCode = (await osmPostcode(lat, lng)) ?? "";
    return {
      address: google.formatted || null,
      line1: google.line1 || null,
      city: google.city || null,
      state: google.state || null,
      country: google.country || null,
      postalCode: google.postalCode || null,
    };
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
  if (!res.ok) return null;
  const data = (await res.json()) as {
    display_name?: string;
    address?: Record<string, string>;
  };
  const a = data.address ?? {};
  const line1 = [a.house_number, a.road].filter(Boolean).join(" ");
  return {
    address: data.display_name ?? null,
    line1: line1 || null,
    city: a.city || a.town || a.village || a.suburb || a.county || null,
    state: a.state || null,
    country: a.country || null,
    postalCode: a.postcode || null,
  };
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

        const key = cacheKey(lat, lng);
        const hit = await cached(key);
        if (hit) return Response.json(hit, { headers: NO_STORE });
        const result = await lookup(lat, lng).catch(() => null);
        if (!result) return Response.json({ address: null }, { headers: NO_STORE });
        if (result.address) await remember(key, result);
        return Response.json(result, { headers: NO_STORE });
      },
    },
  },
});
