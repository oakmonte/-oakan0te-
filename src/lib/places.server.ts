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
  const street = [get("street_number"), get("route")].filter(Boolean).join(" ");
  // A landmark or business pick ("Ikeja City Mall") has no street number; its
  // name is the most useful line 1 then.
  const line1 = street || p.displayName?.text || get("neighborhood") || get("sublocality");
  return {
    line1,
    city:
      get("locality") ||
      get("sublocality") ||
      get("administrative_area_level_2") ||
      get("postal_town"),
    state: get("administrative_area_level_1"),
    country: get("country"),
    postalCode: get("postal_code"),
    lat: p.location?.latitude ?? null,
    lng: p.location?.longitude ?? null,
    formatted: p.formattedAddress ?? "",
  };
}
