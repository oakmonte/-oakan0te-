// Google Places (New) requests and parsing, shared by the browser and the
// server so both read an address identically.
//
// The browser calls Google directly with a public, referrer-restricted key
// (VITE_GOOGLE_PLACES_BROWSER_KEY): a round trip to Google from Nigeria is a
// fraction of one through our server in Washington. The server copy
// (places.server.ts, private key) is the fallback when there's no browser key
// or the direct call fails.

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

/** Throws on a network/HTTP failure so a caller can fall back. */
export async function requestAutocomplete(
  key: string,
  input: string,
  sessionToken: string,
  regionCode: string | null,
  signal?: AbortSignal,
): Promise<PlaceSuggestion[]> {
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
    signal,
  });
  if (!res.ok) {
    throw new Error(`Places autocomplete ${res.status}: ${await res.text().catch(() => "")}`);
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

/** Throws on a network/HTTP failure so a caller can fall back. */
export async function requestPlaceAddress(
  key: string,
  placeId: string,
  sessionToken: string,
): Promise<PlaceAddress | null> {
  if (!/^[\w-]+$/.test(placeId)) return null;
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
    throw new Error(`Places details ${res.status}: ${await res.text().catch(() => "")}`);
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
export function addressFrom(get: (type: string) => string, formatted: string, name: string) {
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
