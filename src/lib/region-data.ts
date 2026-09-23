// Countries and states for the pickup-location picker, without loading the
// package's datasets at module scope.
//
// LocationSheet used to `import Country from "country-state-city/lib/country"`
// (and /lib/state) at the top of the file. That did three bad things, because
// LocationSheet sits behind the /store layout and so is in the module graph of
// every dashboard screen:
//
//   1. Dev SSR broke on every /store/* route. Those files are ESM that import
//      their JSON with no `with { type: "json" }`; Vite's dev server hands
//      node_modules to Node's native loader, which refuses that, and React fell
//      back to client rendering. (Production bundles the JSON, so it was only
//      dev -- which is worse in a way: dev stopped reproducing prod.)
//   2. Every dashboard visit downloaded ~650 KB of country/state data for a
//      sheet most visits never open.
//   3. Every cold server render of a /store page parsed the package's whole
//      10 MB lib chunk (city data included) before responding.
//
// So, the same shape as ./city-data.ts:
//   - Every country ships synchronously as [isoCode, name] -- the picker never
//     reads anything else, and all 250 fit in ~7 KB. There is nothing to wait
//     for on the country list, ever.
//   - Nigeria + USA states ship in the same seed, so the common case never
//     waits either.
//   - Every other country's states are dynamically imported when the sheet
//     mounts, and swap in the moment they land. Dynamic imports are never
//     evaluated during SSR (the sheet only loads them from an effect), so the
//     server render path no longer touches the package at all.
//
// Regenerate the seed with `bun scripts/gen-region-seed.mjs`.
import seed from "./data/region-seed.json";

export type RegionItem = { code: string; name: string };

type Seed = { countries: [string, string][]; states: Record<string, [string, string][]> };
// Through unknown because TypeScript types an imported JSON array as string[][],
// not as pairs -- it cannot see that the generator writes exactly two strings
// per row. The seed test checks the shape against the package itself.
const SEED = seed as unknown as Seed;

const COUNTRIES: RegionItem[] = SEED.countries.map(([code, name]) => ({ code, name }));

type StateModule = (typeof import("country-state-city/lib/state"))["default"];

let fullStates: StateModule | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

/** Every country. Synchronous and complete -- no loading state exists. */
export function getCountries(): RegionItem[] {
  return COUNTRIES;
}

/** The isoCode for a saved country name, or "" when the name is free text that
 *  doesn't match the dataset (older rows were typed by hand). */
export function countryCodeForName(name: string | undefined | null): string {
  if (!name) return "";
  return COUNTRIES.find((c) => c.name === name)?.code ?? "";
}

/** True when this country's states are in the seed, so waiting buys nothing. */
export function isSeededStateCountry(countryCode: string): boolean {
  return countryCode in SEED.states;
}

/** The states for a country that are available right now: the seed for NG/US,
 *  the full dataset once it has loaded, otherwise an empty list. Empty is a
 *  real answer for ~53 countries even once loaded -- the dataset has no states
 *  for them -- which is why the picker always allows a typed value. */
export function getStates(countryCode: string): RegionItem[] {
  if (!countryCode) return [];
  if (fullStates) {
    return fullStates
      .getStatesOfCountry(countryCode)
      .map((s) => ({ code: s.isoCode, name: s.name }));
  }
  return (SEED.states[countryCode] ?? []).map(([code, name]) => ({ code, name }));
}

/** Kick off (or join) the background download of every country's states. */
export function loadAllStates(): Promise<void> {
  if (fullStates) return Promise.resolve();
  loading ??= import("country-state-city/lib/state")
    .then((mod) => {
      fullStates = mod.default;
      listeners.forEach((fn) => fn());
    })
    .catch(() => {
      // Leave `loading` set so a failing network isn't retried on every render.
      // The seeded countries still work, and the state picker always accepts a
      // typed value, so nothing is blocked.
    });
  return loading;
}

export function allStatesReady(): boolean {
  return fullStates !== null;
}

export function subscribeToStates(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
