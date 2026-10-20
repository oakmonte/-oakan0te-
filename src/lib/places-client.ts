// Address suggestions and place details from the browser, shared by the
// address field (AddressAutocomplete) and "use my current location"
// (current-location.ts).
import { authedFetch } from "@/lib/authed-fetch";
import {
  requestAutocomplete,
  requestPlaceAddress,
  type PlaceAddress,
  type PlaceSuggestion,
} from "@/lib/places-google";

// Public, referrer-restricted key: lets the phone ask Google directly instead
// of going through our server in Washington (~1s saved per keystroke from
// Nigeria). Absent, or if a direct call fails, the server route is used.
export const BROWSER_KEY = import.meta.env.VITE_GOOGLE_PLACES_BROWSER_KEY as string | undefined;

export async function fetchSuggestions(
  q: string,
  sessionToken: string,
  regionCode: string | undefined,
  signal: AbortSignal,
): Promise<PlaceSuggestion[]> {
  if (BROWSER_KEY) {
    try {
      return await requestAutocomplete(BROWSER_KEY, q, sessionToken, regionCode ?? null, signal);
    } catch (err) {
      if (signal.aborted) throw err;
      // Fall through to the server route.
    }
  }
  const res = await authedFetch("/api/places/autocomplete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input: q, sessionToken, regionCode }),
    signal,
  });
  const body = (await res.json().catch(() => null)) as { suggestions?: PlaceSuggestion[] } | null;
  return body?.suggestions ?? [];
}

export async function fetchAddress(
  placeId: string,
  sessionToken: string,
): Promise<PlaceAddress | null> {
  if (BROWSER_KEY) {
    try {
      return await requestPlaceAddress(BROWSER_KEY, placeId, sessionToken);
    } catch {
      // Fall through to the server route.
    }
  }
  const res = await authedFetch("/api/places/autocomplete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ placeId, sessionToken }),
  }).catch(() => null);
  const body = (await res?.json().catch(() => null)) as { address?: PlaceAddress | null } | null;
  return body?.address ?? null;
}

export function newToken() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : String(Math.random()).slice(2);
}
