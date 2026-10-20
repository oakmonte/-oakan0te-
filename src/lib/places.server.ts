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
  requestPostalCodeNear,
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

/** Postal code near a pin from Places with the server key, for an address
 *  that came from elsewhere (OpenStreetMap, when Geocoding failed). */
export async function postalCodeNear(lat: number, lng: number, address: string | null) {
  const key = KEY();
  if (!key) return null;
  return requestPostalCodeNear(key, lat, lng, address);
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
  type GeoResult = {
    formatted_address?: string;
    types?: string[];
    address_components?: { long_name?: string; types?: string[] }[];
  };
  const body = (await res.json().catch(() => null)) as {
    status?: string;
    error_message?: string;
    results?: GeoResult[];
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
  // The most precise result that sits on a real street. A building with no
  // street of its own is a block inside a campus or estate ("Esther Hall G
  // Wing, Ota" for a pin in Covenant University's library); the address a
  // rider needs is the place it's inside ("Covenant University, Idiroko Rd").
  const precise = ["street_address", "premise", "subpremise", "route", "establishment"];
  const named = ["street_address", "premise", "subpremise", "establishment"];
  const results = body.results;
  const onStreet = (r: GeoResult) =>
    !!r.address_components?.some((c) => c.types?.includes("route"));
  const best =
    results.find((r) => onStreet(r) && r.types?.some((t) => named.includes(t))) ??
    results.find((r) => r.types?.includes("route")) ??
    results.find((r) => r.types?.some((t) => precise.includes(t))) ??
    results[0];
  // The building that was passed over, kept for address line 2 so the rider
  // still finds the exact block (the GPS pin is saved separately too).
  const inner = results
    .slice(0, results.indexOf(best))
    .find((r) => !onStreet(r) && r.types?.some((t) => named.includes(t)));
  const landmark = inner?.formatted_address?.split(",")[0]?.trim() ?? "";
  const parts = best.address_components ?? [];
  const get = (type: string) => parts.find((c) => c.types?.includes(type))?.long_name ?? "";
  const address = addressFrom(get, best.formatted_address ?? "", "");
  // The street-level result often has no postal code (most Nigerian ones
  // don't); the area-level results for the same pin frequently do.
  if (!address.postalCode) {
    address.postalCode =
      body.results
        .flatMap((r) => r.address_components ?? [])
        .find((c) => c.types?.includes("postal_code"))?.long_name ?? "";
  }
  // Geocoding still often has none where Places does (a typed-and-picked
  // suggestion always comes back with one).
  if (!address.postalCode) {
    address.postalCode =
      (await requestPostalCodeNear(key, lat, lng, best.formatted_address ?? null)) ?? "";
  }
  return {
    ...address,
    landmark: landmark && !address.line1.includes(landmark) ? landmark : "",
    formatted: best.formatted_address ?? "",
  };
}
