import type { GradeRecipe } from "./grade-recipe";
import { generateLut, type LutTable } from "./generate-lut";

// Table generation is cheap (4913 grid points) but there's no reason to pay
// it twice for the same filter — the camera swatch strip, the after-shot
// FilterPanel and the actual capture/export bake all resolve the same filter
// id repeatedly within a session.
const cache = new Map<string, LutTable>();

export function getLutTable(id: string, recipe: GradeRecipe): LutTable {
  let table = cache.get(id);
  if (!table) {
    table = generateLut(recipe);
    cache.set(id, table);
  }
  return table;
}
