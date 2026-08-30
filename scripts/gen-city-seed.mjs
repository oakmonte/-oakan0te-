// Regenerates src/lib/data/city-seed.json — the cities for the countries we
// serve first (Nigeria, USA). Run with: bun scripts/gen-city-seed.mjs
// The full world dataset (8 MB) is loaded lazily at runtime instead.
import { readFileSync, writeFileSync } from "node:fs";

const PRIORITY = ["NG", "US"];
const raw = JSON.parse(
  readFileSync("node_modules/country-state-city/lib/assets/city.json", "utf8"),
);

/** rows are [name, countryCode, stateCode, lat, lng] */
const seed = {};
for (const [name, countryCode, stateCode] of raw) {
  if (!PRIORITY.includes(countryCode)) continue;
  (seed[countryCode] ??= {});
  (seed[countryCode][stateCode] ??= []).push(name);
}
for (const country of Object.values(seed))
  for (const key of Object.keys(country)) country[key].sort((a, b) => a.localeCompare(b));

writeFileSync("src/lib/data/city-seed.json", JSON.stringify(seed));
console.log("wrote src/lib/data/city-seed.json");
