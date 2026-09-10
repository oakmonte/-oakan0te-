// Pure helpers shared between VariantMatrixBuilder (which regenerates the
// combination grid live as options change) and the product edit page (which
// has to reconstruct the exact same grid, with the exact same row keys, from
// a loaded product's saved options — split out of VariantMatrixBuilder.tsx
// rather than left there because a function export alongside a component
// export defeats Fast Refresh for that file.
import type { VariantOption, VariantOptionValue, VariantRow } from "./VariantMatrixBuilder";
import { parseWeightVolumeValueToGrams } from "@/lib/weight-estimate";

// Matches Shopify's ceiling. Without a cap, six modest options would try to
// render tens of thousands of rows and lock up the page.
export const MAX_COMBINATIONS = 2048;

export function buildKey(combo: VariantOptionValue[]) {
  return combo.map((o) => o.value).join("|");
}

// The one option axis that isn't just a buyer-facing label: picking "250 g"
// as a Weight/Volume value IS the seller stating that variant's shipping
// weight, so it pre-fills the Weight box (VariantMatrixBuilder) and locks it
// (VariantCombinationsSheet) rather than sitting alongside a second, freely
// typed number that could contradict it. One predicate, so "which rows get a
// weight from their options" and "which rows have Weight locked" can't drift
// apart into a row showing one number while claiming another.
export function weightVolumeValueOf(combo: VariantOptionValue[]): string | null {
  return combo.find((o) => o.name.trim().toLowerCase() === "weight/volume")?.value ?? null;
}

export function hasWeightVolumeAxis(options: VariantOption[]): boolean {
  return options.some(
    (o) => o.name.trim().toLowerCase() === "weight/volume" && o.values.length > 0,
  );
}

// N-way cartesian product — any number of options, not just two.
export function cartesian(options: VariantOption[]): VariantOptionValue[][] {
  const usable = options.filter((o) => o.name.trim() && o.values.length > 0);
  if (usable.length === 0) return [];

  let combos: VariantOptionValue[][] = [[]];
  for (const opt of usable) {
    const next: VariantOptionValue[][] = [];
    for (const combo of combos) {
      for (const value of opt.values) {
        next.push([...combo, { name: opt.name, value }]);
        if (next.length >= MAX_COMBINATIONS) return next;
      }
    }
    combos = next;
  }
  return combos;
}

// A row's own Weight/Volume option value (if it has one) is the seller
// directly telling us this SKU's weight, not a guess — so it pre-fills the
// row's Weight box rather than leaving it empty.
function weightGramsFromCombo(combo: VariantOptionValue[]): number | null {
  const wv = weightVolumeValueOf(combo);
  return wv ? parseWeightVolumeValueToGrams(wv) : null;
}

/** Rebuild the variant grid after the options list changed, carrying the
 *  seller's existing per-row work across.
 *
 *  Kept pure (and tested) because getting it wrong is silent and expensive:
 *  every price, stock count, SKU and image a seller has typed lives in these
 *  rows, and a row that fails to match its predecessor comes back blank with
 *  no error anywhere. */
export function regenerateRows(options: VariantOption[], prevRows: VariantRow[]): VariantRow[] {
  const combos = cartesian(options);
  const prevByKey = new Map(prevRows.map((r) => [r.key, r]));
  // A row's key is its values joined, so ADDING an axis rekeys every existing
  // row at once ("Small" becomes "Small|Black") and an exact lookup misses all
  // of them — which used to blank everything already entered. An old row whose
  // values are all still present in the new combo is that same variant with
  // one more axis pinned to it, so its data carries forward (one old row seeds
  // each of the N new rows it split into). Only consulted on an exact-key
  // miss, so the ordinary "a value was renamed/removed" path costs nothing.
  const prevSets = prevRows.map((r) => ({
    row: r,
    values: new Set(r.options.map((o) => o.value)),
  }));
  const inheritFrom = (combo: VariantOptionValue[]): VariantRow | undefined => {
    const values = new Set(combo.map((o) => o.value));
    return prevSets.find(
      (p) =>
        p.values.size > 0 &&
        p.values.size < values.size &&
        [...p.values].every((v) => values.has(v)),
    )?.row;
  };

  return combos.map((combo) => {
    const key = buildKey(combo);
    const existing = prevByKey.get(key) ?? inheritFrom(combo);
    // Keep the seller's edits (and their checkbox), but always refresh the
    // option labels in case a name was renamed. `key` comes from the combo,
    // never from `existing` — an inherited row adopts its new identity.
    //
    // weightGrams is the one field an inherited row can't carry over blindly:
    // adding a Weight/Volume axis is exactly when inheritance fires, and that
    // axis exists to pre-fill Weight. `??` so it only fills a blank — a weight
    // the seller typed by hand still wins.
    return existing
      ? {
          ...existing,
          key,
          options: combo,
          weightGrams: existing.weightGrams ?? weightGramsFromCombo(combo),
        }
      : {
          key,
          options: combo,
          selected: true,
          price: "",
          compareAtPrice: "",
          costPrice: "",
          sku: "",
          mainImageUrl: "",
          continueSellingOutOfStock: false,
          locationQuantities: {},
          weightGrams: weightGramsFromCombo(combo),
        };
  });
}
