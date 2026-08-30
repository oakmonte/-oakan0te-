// City lookup that opens instantly for the countries we serve first.
//
// `country-state-city`'s city dataset is a single ~8 MB JSON blob — importing
// it alongside Country/State means the location sheet can't render until the
// whole world has downloaded. So:
//   - Nigeria + USA cities ship as a small pre-built seed (src/lib/data/city-seed.json,
//     regenerate with `bun scripts/gen-city-seed.mjs`) and are available synchronously.
//   - The full dataset is dynamically imported in the background the moment the
//     sheet mounts, and swaps in for every other country once it lands.
import seed from "./data/city-seed.json";

type Seed = Record<string, Record<string, string[]>>;
const SEED = seed as Seed;

type CityModule = (typeof import("country-state-city"))["City"];

let fullCities: CityModule | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

/** Kick off (or join) the background download of the full world city dataset. */
export function loadAllCities(): Promise<void> {
  if (fullCities) return Promise.resolve();
  loading ??= import("country-state-city")
    .then((mod) => {
      fullCities = mod.City;
      listeners.forEach((fn) => fn());
    })
    .catch(() => {
      // Leave `loading` set so we don't hammer a failing network; the seed
      // countries still work and every picker allows a typed custom value.
    });
  return loading;
}

export function allCitiesReady() {
  return fullCities !== null;
}

/** True when this country is covered by the seed, so waiting buys nothing. */
export function isSeededCountry(countryCode: string) {
  return countryCode in SEED;
}

export function subscribeToCities(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** City names for a country (optionally narrowed to one state). Returns what's
 *  available right now — the seed for NG/US, the full dataset once loaded. */
export function getCityNames(countryCode: string, stateCode: string): string[] {
  if (fullCities) {
    const rows = stateCode
      ? fullCities.getCitiesOfState(countryCode, stateCode)
      : (fullCities.getCitiesOfCountry(countryCode) ?? []);
    return rows.map((c) => c.name);
  }
  const country = SEED[countryCode];
  if (!country) return [];
  if (stateCode) return country[stateCode] ?? [];
  return Object.values(country).flat();
}
