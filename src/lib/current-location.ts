// "Use my current location", shared by checkout and the store's pickup
// locations: a GPS pin -> the address fields, on any phone, laptop or browser.
import { authedFetch } from "@/lib/authed-fetch";
import { fetchAddress, fetchSuggestions, newToken } from "@/lib/places-client";

export type HereAddress = {
  address: string | null;
  line1: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
};

/** The device's most precise position, without waiting for precision that
 *  isn't coming. Watches the precise (GPS) reading and keeps the best one;
 *  stops at GPS-grade accuracy, or once readings stop improving for a few
 *  seconds -- which on a laptop (no GPS, Wi-Fi only) is right after its first
 *  answer, where a one-shot precise request used to sit out its whole
 *  timeout. A coarse reading is asked for alongside, used only if the precise
 *  one fails or never arrives (indoors, GPS off). */
export function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      reject(Object.assign(new Error("Geolocation unavailable"), { code: 2 }));
      return;
    }
    const geo = navigator.geolocation;
    let precise: GeolocationPosition | null = null;
    let coarse: GeolocationPosition | null = null;
    let preciseFailed = false;
    let lastError: GeolocationPositionError | null = null;
    let done = false;
    let settle: ReturnType<typeof setTimeout> | undefined;

    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(settle);
      clearTimeout(cap);
      geo.clearWatch(watch);
      const best = precise ?? coarse;
      if (best) resolve(best);
      else reject(lastError ?? Object.assign(new Error("Timed out"), { code: 3 }));
    };
    const denied = (err: GeolocationPositionError) => {
      lastError = err;
      precise = coarse = null;
      finish();
    };

    const cap = setTimeout(finish, 15_000);
    const watch = geo.watchPosition(
      (pos) => {
        if (done) return;
        if (precise && pos.coords.accuracy >= precise.coords.accuracy) return;
        precise = pos;
        if (pos.coords.accuracy <= 20) return finish();
        clearTimeout(settle);
        settle = setTimeout(finish, 3000);
      },
      (err) => {
        if (done) return;
        if (err.code === err.PERMISSION_DENIED) return denied(err);
        lastError = err;
        preciseFailed = true;
        if (precise || coarse) finish();
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 12_000 },
    );
    geo.getCurrentPosition(
      (pos) => {
        if (done) return;
        coarse = pos;
        if (preciseFailed) finish();
      },
      (err) => {
        if (done) return;
        if (err.code === err.PERMISSION_DENIED) return denied(err);
        lastError = err;
        if (preciseFailed && !precise) finish();
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 12_000 },
    );
  });
}

const km = (a: [number, number], b: [number, number]) => {
  const rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad;
  const dLng = (b[1] - a[1]) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
  return 12_742 * Math.asin(Math.sqrt(h));
};

/** Postal code for an address Google already named, found the way a typed
 *  address finds one: suggestions for the text, then the picked place's
 *  details. Reverse geocoding often has no postal code in Nigeria; place
 *  details nearly always do. Only accepts a place near the pin. */
async function postalCodeFor(address: string, lat: number, lng: number) {
  const token = newToken();
  const signal = AbortSignal.timeout(5000);
  const suggestions = await fetchSuggestions(address, token, undefined, signal).catch(() => []);
  for (const s of suggestions.slice(0, 2)) {
    const place = await fetchAddress(s.placeId, token).catch(() => null);
    if (!place?.postalCode) continue;
    if (place.lat != null && place.lng != null && km([lat, lng], [place.lat, place.lng]) > 5) {
      continue;
    }
    return place.postalCode;
  }
  return null;
}

/** The address at a pin: the server's reverse lookup, with the postal code
 *  filled from Places when that lookup has none. */
export async function addressAt(lat: number, lng: number): Promise<HereAddress | null> {
  const res = await authedFetch("/api/shipping/reverse-geocode", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lng }),
  });
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as HereAddress | null;
  if (body?.address && !body.postalCode) {
    body.postalCode = await postalCodeFor(body.address, lat, lng);
  }
  return body;
}
