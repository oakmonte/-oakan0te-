import { test, expect, describe } from "bun:test";
import Country from "country-state-city/lib/country";
import State from "country-state-city/lib/state";
import { countryCodeForName, getCountries, getStates, isSeededStateCountry } from "./region-data";

// The seed replaces a runtime read of the package's datasets, so if it ever
// drifts from them (a package upgrade adding a country, renaming a state) a
// seller's saved location stops matching the picker without any error. These
// compare the seed against the package it was generated from.
describe("region seed matches country-state-city", () => {
  test("has every country, with the same code and name", () => {
    const fromPackage = Country.getAllCountries().map((c) => ({ code: c.isoCode, name: c.name }));
    expect(getCountries()).toEqual(fromPackage);
  });

  // Compared as sets: getStatesOfCountry sorts and the seed keeps file order,
  // and order is not part of the contract -- LocationSheet sorts by name for
  // display either way.
  test("has every Nigerian and US state, with the same code and name", () => {
    const byCode = (a: { code: string }, b: { code: string }) => a.code.localeCompare(b.code);
    for (const cc of ["NG", "US"]) {
      const fromPackage = State.getStatesOfCountry(cc)
        .map((s) => ({ code: s.isoCode, name: s.name }))
        .sort(byCode);
      expect([...getStates(cc)].sort(byCode)).toEqual(fromPackage);
    }
  });
});

describe("countryCodeForName", () => {
  test("resolves a saved country name to its code", () => {
    expect(countryCodeForName("Nigeria")).toBe("NG");
    expect(countryCodeForName("United States")).toBe("US");
  });

  // Older rows were typed by hand. They must fall back to "no code" -- which
  // leaves the field editable -- rather than matching something wrong.
  test("returns empty for free text, empty and missing values", () => {
    expect(countryCodeForName("Naija")).toBe("");
    expect(countryCodeForName("")).toBe("");
    expect(countryCodeForName(undefined)).toBe("");
    expect(countryCodeForName(null)).toBe("");
  });
});

describe("getStates before the full dataset loads", () => {
  test("seeded countries answer immediately", () => {
    expect(isSeededStateCountry("NG")).toBe(true);
    expect(getStates("NG").find((s) => s.code === "LA")?.name).toBe("Lagos");
  });

  // Unseeded countries have nothing yet. Empty, not a guess -- the sheet shows
  // a loading note and the picker accepts a typed value in the meantime.
  test("unseeded countries are empty until loaded", () => {
    expect(isSeededStateCountry("GH")).toBe(false);
    expect(getStates("GH")).toEqual([]);
  });

  test("no country, no states", () => {
    expect(getStates("")).toEqual([]);
  });
});
