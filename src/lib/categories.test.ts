import { test, expect, describe } from "bun:test";
import {
  ROOT_CATEGORY,
  type CategoryNode,
  categoryPathFromProductType,
  customCategoryNode,
  isCustomCategory,
  productTypeForPath,
} from "./categories";
import {
  FOOTWEAR_CATEGORY_ID,
  SHOE_CARE_CATEGORY_ID,
  SIZE_CHART_CATEGORY_IDS,
  PRESET_MEASUREMENT_CATEGORY_IDS,
  getPresetMeasurementsForCategory,
  getSizeChartForCategory,
  isFootwearCategory,
} from "./size-chart-config";
import { NECESSITY_CATEGORY_IDS, paramsForCategory } from "./necessities";

function allNodes(node: CategoryNode): CategoryNode[] {
  return [node, ...(node.children ?? []).flatMap(allNodes)];
}

const NODES = allNodes(ROOT_CATEGORY).slice(1);
const IDS = new Set(NODES.map((n) => n.id));

function pathTo(id: string): CategoryNode[] {
  function walk(node: CategoryNode, path: CategoryNode[]): CategoryNode[] | null {
    for (const child of node.children ?? []) {
      const next = [...path, child];
      if (child.id === id) return next;
      const found = walk(child, next);
      if (found) return found;
    }
    return null;
  }
  const path = walk(ROOT_CATEGORY, []);
  if (!path) throw new Error(`no category ${id}`);
  return path;
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((v) => (seen.has(v) ? true : (seen.add(v), false)));
}

describe("category tree", () => {
  // products.product_type stores the picked node's name and the edit page
  // resolves it back by name, so two nodes sharing a name reopen as whichever
  // comes first — an adult tee used to reopen as Activewear T-Shirts.
  test("every node name is unique, ignoring case", () => {
    expect(duplicates(NODES.map((n) => n.name.trim().toLowerCase()))).toEqual([]);
  });

  test("every node id is unique", () => {
    expect(duplicates(NODES.map((n) => n.id))).toEqual([]);
  });

  test("the top level is Fashion, Beauty & Personal Care, Art & Crafts", () => {
    expect(ROOT_CATEGORY.children?.map((n) => n.name)).toEqual([
      "Fashion",
      "Beauty & Personal Care",
      "Art & Crafts",
    ]);
  });
});

describe("maps keyed by category id", () => {
  test("every size chart key is a real category", () => {
    expect(SIZE_CHART_CATEGORY_IDS.filter((id) => !IDS.has(id))).toEqual([]);
  });

  test("every necessities key is a real category", () => {
    expect(NECESSITY_CATEGORY_IDS.filter((id) => !IDS.has(id))).toEqual([]);
  });

  test("the footwear ids are real categories", () => {
    expect(IDS.has(FOOTWEAR_CATEGORY_ID)).toBe(true);
    expect(IDS.has(SHOE_CARE_CATEGORY_ID)).toBe(true);
  });
});

describe("chart lookups through the new tree", () => {
  test("T-Shirts and Kids' T-Shirts get their own tee guides", () => {
    expect(getSizeChartForCategory(pathTo("t-shirts"))?.guide).toBe("standard-tshirt");
    expect(getSizeChartForCategory(pathTo("kids-t-shirts"))?.guide).toBe("tshirt");
  });

  test("shoes get the shoe-size ladder; shoe care does not", () => {
    expect(isFootwearCategory(pathTo("sneakers"))).toBe(true);
    expect(isFootwearCategory(pathTo("kids-shoes"))).toBe(true);
    expect(isFootwearCategory(pathTo("shoe-care"))).toBe(false);
    expect(isFootwearCategory(pathTo("t-shirts"))).toBe(false);
  });
});

describe("custom categories", () => {
  test("round-trip through product_type with their branch", () => {
    const path = [...pathTo("clothing"), customCategoryNode("Aso oke robe")];
    const stored = productTypeForPath(path);
    expect(stored).toBe("Clothing › Aso oke robe");
    const back = categoryPathFromProductType(stored!);
    expect(back?.map((n) => n.name)).toEqual(["Fashion", "Clothing", "Aso oke robe"]);
    expect(isCustomCategory(back?.at(-1))).toBe(true);
  });

  test("a custom item under Clothing still gets asked for Size", () => {
    const path = categoryPathFromProductType("Clothing › Aso oke robe")!;
    expect(paramsForCategory(path, "variant")).toContain("Size");
  });

  test("real categories store and resolve by plain name", () => {
    expect(productTypeForPath(pathTo("kids-t-shirts"))).toBe("Kids' T-Shirts");
    expect(categoryPathFromProductType("T-Shirts")?.at(-1)?.id).toBe("t-shirts");
  });

  test("unknown strings stay unresolved so the seller re-picks", () => {
    expect(categoryPathFromProductType("Some Shopify Type")).toBeNull();
    expect(categoryPathFromProductType("Nowhere › Thing")).toBeNull();
  });
});

describe("kids' pieces borrow the adult guide", () => {
  test("tops, trousers, shorts and dresses", () => {
    expect(getSizeChartForCategory(pathTo("kids-tops"))?.guide).toBe("standard-tshirt");
    expect(getSizeChartForCategory(pathTo("kids-trousers"))?.guide).toBe(
      "baggy-corporate-trousers",
    );
    expect(getSizeChartForCategory(pathTo("kids-shorts"))?.guide).toBe("shorts");
    expect(getSizeChartForCategory(pathTo("kids-dresses"))?.guide).toBe("a-line-dress");
  });
});

describe("preset measurements", () => {
  test("every key is a real category", () => {
    expect(PRESET_MEASUREMENT_CATEGORY_IDS.filter((id) => !IDS.has(id))).toEqual([]);
  });

  // Anything that asks for Size but has no guide picture must still open
  // with a measurement list, never a blank "name your own" sheet.
  test("every Size-asking category without a chart has presets", () => {
    const missing = NODES.filter((n) => {
      const path = pathTo(n.id);
      return (
        paramsForCategory(path, "variant").includes("Size") &&
        !getSizeChartForCategory(path) &&
        getPresetMeasurementsForCategory(path).length === 0
      );
    }).map((n) => n.id);
    expect(missing).toEqual([]);
  });

  test("a custom category inherits its group's presets", () => {
    const path = categoryPathFromProductType("Clothing › Aso oke robe")!;
    expect(getPresetMeasurementsForCategory(path)).toEqual(["Chest", "Waist", "Hip", "Length"]);
  });
});
