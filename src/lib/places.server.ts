// Google Places (New) for address suggestions while typing. Shipbubble only
// checks a finished address; it has no autocomplete, so this sits in front of
// it: the seller or buyer picks a real address here, Shipbubble validates it
// after (api.store.locations.verify / api.shipping.address).
//
// Server-only: the key never reaches the browser. With no key configured
// every call returns nothing, so the forms just behave as plain inputs.

const KEY = () => process.env.GOOGLE_PLACES_API_KEY;

export type PlaceSuggestion = { placeId: string; main: string; secondary: string };

export type PlaceAddress = {
  line1: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  lat: number | null;
  lng: number | null;
  formatted: string;
};

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

export async function autocomplete(
  input: string,
  sessionToken: string,
  regionCode: string | null,
): Promise<PlaceSuggestion[]> {
  const key = KEY();
  if (!key || input.trim().length < 3) return [];
  const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key },
    body: JSON.stringify({
      input,
      sessionToken,
      ...(regionCode
        ? { includedRegionCodes: [regionCode.toLowerCase()], regionCode: regionCode.toLowerCase() }
        : {}),
    }),
  });
  if (!res.ok) {
    console.error("Places autocomplete failed:", res.status, await res.text().catch(() => ""));
    return [];
  }
  const body = (await res.json().catch(() => null)) as {
    suggestions?: {
      placePrediction?: {
        placeId?: string;
        text?: { text?: string };
        structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } };
      };
    }[];
  } | null;
  return (body?.suggestions ?? []).flatMap((s) => {
    const p = s.placePrediction;
    if (!p?.placeId) return [];
    return [
      {
        placeId: p.placeId,
        main: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
        secondary: p.structuredFormat?.secondaryText?.text ?? "",
      },
    ];
  });
}

type Component = { longText?: string; shortText?: string; types?: string[] };

export async function placeAddress(
  placeId: string,
  sessionToken: string,
): Promise<PlaceAddress | null> {
  const key = KEY();
  if (!key || !/^[\w-]+$/.test(placeId)) return null;
  const res = await fetch(
    `https://places.googleapis.com/v1/places/${placeId}?sessionToken=${encodeURIComponent(sessionToken)}`,
    {
      headers: {
        "X-Goog-Api-Key": key,
        // Only what fills the form: keeps the call in the cheaper tier.
        "X-Goog-FieldMask": "addressComponents,formattedAddress,location,displayName",
      },
    },
  );
  if (!res.ok) {
    console.error("Places details failed:", res.status, await res.text().catch(() => ""));
    return null;
  }
  const p = (await res.json().catch(() => null)) as {
    addressComponents?: Component[];
    formattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
    displayName?: { text?: string };
  } | null;
  if (!p) return null;
  const parts = p.addressComponents ?? [];
  const get = (type: string) => parts.find((c) => c.types?.includes(type))?.longText ?? "";
  return {
    ...addressFrom(get, p.formattedAddress ?? "", p.displayName?.text ?? ""),
    lat: p.location?.latitude ?? null,
    lng: p.location?.longitude ?? null,
    formatted: p.formattedAddress ?? "",
  };
}

// Shared by a picked suggestion and a GPS lookup: Google's address parts ->
// the form's fields.
function addressFrom(get: (type: string) => string, formatted: string, name: string) {
  const city =
    get("locality") ||
    get("sublocality") ||
    get("administrative_area_level_2") ||
    get("postal_town");
  const state = get("administrative_area_level_1");
  const country = get("country");
  const postalCode = get("postal_code");
  // Line 1 is the formatted address minus its city/state/country tail.
  // Nigerian addresses lean on plot numbers, estates and "off X road" that
  // street_number + route drop ("Plot 2, Kayode Animashaun Street, Off
  // Admiralty Wy, Lekki Phase 1" vs just "Off Admiralty Way").
  const tail = [city, state, country].filter(Boolean).map((t) => t.toLowerCase());
  const segments = formatted.split(",").map((t) => t.trim());
  while (segments.length > 1) {
    const last = segments[segments.length - 1].toLowerCase();
    const isTail =
      tail.some((t) => last === t) || (!!postalCode && last.includes(postalCode.toLowerCase()));
    if (!isTail) break;
    segments.pop();
  }
  const street = [get("street_number"), get("route")].filter(Boolean).join(" ");
  const fromFormatted = segments.join(", ");
  const line1 =
    (fromFormatted && fromFormatted.length >= street.length ? fromFormatted : street) ||
    name ||
    get("neighborhood") ||
    "";
  return { line1, city, state, country, postalCode };
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
