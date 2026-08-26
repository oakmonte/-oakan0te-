// Pure helpers shared between VariantMatrixBuilder (which regenerates the
// combination grid live as options change) and the product edit page (which
// has to reconstruct the exact same grid, with the exact same row keys, from
// a loaded product's saved options — split out of VariantMatrixBuilder.tsx
// rather than left there because a function export alongside a component
// export defeats Fast Refresh for that file.
import type { VariantOption, VariantOptionValue } from "./VariantMatrixBuilder";

// Matches Shopify's ceiling. Without a cap, six modest options would try to
// render tens of thousands of rows and lock up the page.
export const MAX_COMBINATIONS = 2048;

export function buildKey(combo: VariantOptionValue[]) {
  return combo.map((o) => o.value).join("|");
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
