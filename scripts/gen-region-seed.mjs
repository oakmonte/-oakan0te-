// Regenerates src/lib/data/region-seed.json -- every country as [isoCode, name],
// plus the states of the countries we serve first (Nigeria, USA).
// Run with: bun scripts/gen-region-seed.mjs
//
// Why a seed at all: country-state-city's country.json (96 KB) and state.json
// (555 KB) used to be imported at module scope by LocationSheet, which sits
// behind the /store layout -- so every dashboard visit downloaded ~650 KB of
// reference data, and every cold server render parsed the package's 10 MB lib.
// The picker only ever reads a country's code and name, so the whole country
// list fits in a few KB and ships synchronously. Only other countries' states
// are loaded lazily, when the sheet opens. See src/lib/region-data.ts.
import { readFileSync, writeFileSync } from "node:fs";

const PRIORITY = ["NG", "US"];
const read = (name) =>
  JSON.parse(readFileSync(`node_modules/country-state-city/lib/assets/${name}.json`, "utf8"));

const countries = read("country").map((c) => [c.isoCode, c.name]);

const states = {};
for (const s of read("state")) {
  if (!PRIORITY.includes(s.countryCode)) continue;
  (states[s.countryCode] ??= []).push([s.isoCode, s.name]);
}

writeFileSync("src/lib/data/region-seed.json", JSON.stringify({ countries, states }));
console.log(
  `wrote src/lib/data/region-seed.json: ${countries.length} countries, ` +
    Object.entries(states)
      .map(([k, v]) => `${v.length} ${k} states`)
      .join(", "),
);
