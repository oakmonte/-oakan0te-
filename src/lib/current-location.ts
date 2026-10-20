// "Use my current location", shared by checkout and the store's pickup
// locations: a GPS pin -> the address fields, on any phone, laptop or browser.
import { authedFetch } from "@/lib/authed-fetch";
import { BROWSER_KEY, fetchAddress, fetchSuggestions, newToken } from "@/lib/places-client";
import { requestPostalCodeNear } from "@/lib/places-google";

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
 *  one fails or never arrives (indoors, GPS off) -- or, on a computer, shortly
 *  after it lands: with no GPS, the "precise" reading is the same Wi-Fi fix,
 *  just slower (Windows can take ~10 s), so waiting buys no accuracy. */
export function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      reject(Object.assign(new Error("Geolocation unavailable"), { code: 2 }));
      return;
    }
    const geo = navigator.geolocation;
    // Phones and tablets have GPS; iPadOS reports itself as a Mac with touch.
    const ua = navigator.userAgent;
    const hasGps =
      /Android|iPhone|iPad|iPod|Mobile/i.test(ua) ||
      (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
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
        else if (!hasGps && !precise) settle = setTimeout(finish, 1500);
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

/** What to tell someone when getPosition fails. */
export function locationErrorMessage(err: unknown) {
  const code = (err as { code?: number } | null)?.code;
  if (code === 1) {
    return "Location is blocked for this site. Allow it from the icon by the address bar, or fill this in by hand.";
  }
  if (code === 3) return "Finding your location took too long. Try again, or fill this in by hand.";
  // POSITION_UNAVAILABLE: offline (a computer looks itself up from nearby
  // Wi-Fi, online) or the device's own location setting is off.
  return "Couldn't find your location. Check your internet connection and that Location is on in your device settings, then try again.";
}

/** Postal code for the address at a pin, from Places in the browser (its
 *  key is the one typed suggestions already use, so it's known to work):
 *  a search for the address and the places nearest the pin, then a typed-style
 *  suggestion lookup on the short form of the address ("Covenant University,
 *  Idi-Iroko Road" -- autocomplete matches nothing on the full formatted line). */
async function postalCodeFor(address: string, lat: number, lng: number) {
  if (BROWSER_KEY) {
    const code = await requestPostalCodeNear(BROWSER_KEY, lat, lng, address);
    if (code) return code;
  }
  const short = address.split(",").slice(0, 2).join(",").trim();
  const token = newToken();
  const suggestions = await fetchSuggestions(
    short,
    token,
    undefined,
    AbortSignal.timeout(5000),
  ).catch(() => []);
  for (const s of suggestions.slice(0, 3)) {
    const place = await fetchAddress(s.placeId, token).catch(() => null);
    if (!place?.postalCode) continue;
    if (
      place.lat != null &&
      place.lng != null &&
      Math.hypot(place.lat - lat, place.lng - lng) > 0.05
    ) {
      continue;
    }
    return place.postalCode;
  }
  console.warn("Current location: no postal code found for", short);
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
