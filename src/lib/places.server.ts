// Google Places (New) for address suggestions while typing. Shipbubble only
// checks a finished address; it has no autocomplete, so this sits in front of
// it: the seller or buyer picks a real address here, Shipbubble validates it
// after (api.store.locations.verify / api.shipping.address).
//
// This file holds the private key and runs on the server. The browser
// normally asks Google itself with a separate public key (places-google.ts)
// and only falls back to these routes. With no key configured every call
// returns nothing, so the forms just behave as plain inputs.

const KEY = () => process.env.GOOGLE_PLACES_API_KEY;

import {
  addressFrom,
  requestAutocomplete,
  requestPlaceAddress,
  type PlaceAddress,
  type PlaceSuggestion,
} from "./places-google";

export type { PlaceAddress, PlaceSuggestion };

// Per-caller window: each keystroke is a paid call past the free allowance,
// so a loop can't run up the bill. In-memory, per instance -- a speed bump.
const hits = new Map<string, number[]>();
export function placesLimited(key: string) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > 60;
}

// The server's copy, with the private key: the fallback for the browser's
// direct calls (places-google.ts).
export async function autocomplete(
  input: string,
  sessionToken: string,
  regionCode: string | null,
): Promise<PlaceSuggestion[]> {
  const key = KEY();
  if (!key || input.trim().length < 3) return [];
  return requestAutocomplete(key, input, sessionToken, regionCode).catch((err) => {
    console.error(err);
    return [];
  });
}

export async function placeAddress(
  placeId: string,
  sessionToken: string,
): Promise<PlaceAddress | null> {
  const key = KEY();
  if (!key) return null;
  return requestPlaceAddress(key, placeId, sessionToken).catch((err) => {
    console.error(err);
    return null;
  });
}

/** GPS pin -> address with Google's Geocoding API (needs "Geocoding API"
 *  enabled on the key). Null when there's no key or Google has nothing, so
 *  the caller can fall back. Prefers a precise street-level result over the
 *  area-level ones Google also returns. */
export async function reverseGeocodeGoogle(lat: number, lng: number) {
  const key = KEY();
  if (!key) return null;
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}`,
  );
  const body = (await res.json().catch(() => null)) as {
    status?: string;
    error_message?: string;
    results?: {
      formatted_address?: string;
      types?: string[];
      address_components?: { long_name?: string; types?: string[] }[];
    }[];
  } | null;
  if (!res.ok || body?.status !== "OK" || !body.results?.length) {
    if (body?.status !== "ZERO_RESULTS") {
      console.error(
        "Google reverse geocode failed:",
        res.status,
        body?.status,
        body?.error_message,
      );
    }
    return null;
  }
  const precise = ["street_address", "premise", "subpremise", "route", "establishment"];
  const best =
    body.results.find((r) => r.types?.some((t) => precise.includes(t))) ?? body.results[0];
  const parts = best.address_components ?? [];
  const get = (type: string) => parts.find((c) => c.types?.includes(type))?.long_name ?? "";
  return {
    ...addressFrom(get, best.formatted_address ?? "", ""),
    formatted: best.formatted_address ?? "",
  };
}
