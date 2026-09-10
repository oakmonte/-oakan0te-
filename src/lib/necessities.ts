// Pure necessity-computation logic, kept out of NecessitiesSheet.tsx (the
// component) so that file can stay component-only -- mixing a component
// export with plain function/const exports in one file breaks Fast Refresh
// for it (the react-refresh/only-export-components lint rule), and this
// project's CLAUDE.md caps the accepted count of that warning at exactly 6,
// all pre-existing in components/ui/*.
import { CategoryNode } from "@/lib/categories";
import { VariantOption, VariantRow } from "@/components/product-form/VariantMatrixBuilder";
import type { ManualSize, SizeMeasurements } from "@/lib/size-chart-config";

// Which category-specific parameters a category requires before a product in
// it can be published, keyed by category id anywhere in the chosen path —
// not just the leaf, since e.g. "Dresses" and "Shorts" both fall under
// "Clothing" and share the same requirements. Covers every top-level Apparel
// & Accessories branch, plus the Apparel & Accessories root itself as a
// fallback for sellers who stop there without drilling into a branch; Size
// is only included where it's actually standardized (clothing, costumes,
// shoes) — small-accessory branches don't share a size axis. Beauty &
// Personal Care / Art & Crafts have no category-specific tracked fields
// yet — selecting either of those (at any depth) falls through to just the
// universal params below (Link content).
// A closed set, not `string`. Every necessity needs BOTH a fill-state rule
// (paramFillState) and something that happens when its row is tapped
// (NecessitiesSheet's handleTap) -- and those live in different files, so
// adding one and forgetting the other is easy and silent. Color shipped in
// exactly that state: listed, checkable, and wired to `() => {}`. With this
// union both sites switch exhaustively, so the next addition is a compile
// error until it's actually finished.
export type NecessityParam = "Size" | "Color" | "Material" | "Weight" | "Link content";

const NECESSITY_PARAMS: Record<string, NecessityParam[]> = {
  "apparel-accessories": ["Size", "Color", "Material"],
  clothing: ["Size", "Color", "Material"],
  "costumes-accessories": ["Size", "Color", "Material"],
  shoes: ["Size", "Color", "Material"],
  "clothing-accessories": ["Color", "Material"],
  "shoe-accessories": ["Color", "Material"],
  "handbags-wallets-cases": ["Color", "Material"],
  "handbag-wallet-accessories": ["Material", "Color"],
  jewelry: ["Material", "Color"],
};

// Applies to every category, regardless of what else it tracks: "Link
// content" because a product isn't ready to publish without one, "Weight"
// because shipping needs it for literally any physical product, not just
// categories with a Size/Material axis (a lipstick or a craft item still
// ships in a box).
const UNIVERSAL_PARAMS: NecessityParam[] = ["Weight", "Link content"];

// Every param this list can return, for a given category + product kind.
// "Color" is dropped for a regular (non-variant) product: unlike Material,
// there is no `color` column anywhere for one — only product_variants has a
// dedicated field for it via option values, so a regular product structurally
// cannot satisfy it. Listing an unsatisfiable necessity would be worse than
// not listing it at all (a permanently-empty row with no action that could
// ever fill it), so it's excluded rather than shown-but-impossible.
export function paramsForCategory(
  categoryPath: CategoryNode[],
  kind: "regular" | "variant",
): NecessityParam[] {
  if (categoryPath.length === 0) return [];
  // Walk leaf-to-root so a specific branch (e.g. Jewelry) wins over the
  // broader Apparel & Accessories root fallback further up the same path.
  let params: NecessityParam[] | null = null;
  for (let i = categoryPath.length - 1; i >= 0; i--) {
    const match = NECESSITY_PARAMS[categoryPath[i].id];
    if (match) {
      params = [...match, ...UNIVERSAL_PARAMS];
      break;
    }
  }
  params ??= [...UNIVERSAL_PARAMS];
  return kind === "regular" ? params.filter((p) => p !== "Color") : params;
}

export type FillState = "empty" | "partial" | "filled";

// A seller who taps the "Size"/"Color"/"Material" preset chip in
// OptionEditorSheet gets that exact capitalization, but free-typing a custom
// option name is equally supported there (see OptionEditorSheet.tsx) — a
// seller who types "Colour", "Sizes", or "Fabric" instead is naming the same
// real-world axis. Matched here so that a seller's own spelling doesn't (a)
// leave a genuinely-filled axis reading as permanently empty and blocking
// Save over nothing, or worse (b) leave the Size fallback branch below never
// seeing a "real" Size axis, silently reopening the bare-manual-pick bypass
// this whole file exists to close.
const OPTION_NAME_SYNONYMS: Record<string, string> = {
  colour: "color",
  shade: "color",
  sizes: "size",
  fabric: "material",
  materials: "material",
};

export function normalizeOptionName(name: string): string {
  const lower = name.trim().toLowerCase();
  return OPTION_NAME_SYNONYMS[lower] ?? lower;
}

export function findOption(options: VariantOption[], param: string): VariantOption | undefined {
  const target = normalizeOptionName(param);
  return options.find((o) => normalizeOptionName(o.name) === target);
}

// Read-only by design — a seller can't check these off by hand, only by
// actually filling in the underlying field. Variant products carry Size/
// Color/Material as option names; a regular product has a dedicated
// `material` field (MaterialSheet) but no Color field at all (see
// paramsForCategory). "Link content" is filled once the product is tagged to
// at least one post or draft (LinkContentSheet, writing to
// post_product_tags — the same table LinkProductsSheet.tsx writes from the
// post side, so a link from either screen shows on both).
//
// Three states, not two: a param a seller has started but not finished
// (e.g. measurements entered for 2 of 4 sizes, or a Weight/Color option
// added with no values picked yet) reads as "partial" (a loading/in-
// progress glyph), not the same blank box as a param never touched at all
// — and never the black check that's reserved for actually done. Ticking a
// param the moment its variant option merely *exists* (regardless of
// whether it has real values, or — for Size — real measurements behind it)
// was the bug this replaced: an empty "Size" option used to satisfy Size
// necessity just by being named that.
//
// "Size" is chart-independent on purpose: whether the cm/in numbers came
// from an illustrated chart (SizeChartSheet, for categories in
// size-chart-config.ts) or a seller-typed free-form measurement
// (ManualSizeOnlySheet, everywhere else — shoes/dresses/costumes don't
// have a sourced chart yet, see the root CLAUDE.md pre-launch note) is
// irrelevant to whether Size is *filled*: both write into the same
// sizeMeasurements shape, so both are checked the same way.
//   - Variant Size axis exists (options has a "Size"-like entry): filled
//     once every one of those values has at least one measurement recorded,
//     partial once some (not all) do — matches the swipe-through-every-
//     size flow in SizeChartSheet/ManualSizeOnlySheet.
//   - No Variant Size axis (regular product, or variant product that only
//     varies by e.g. Color/Material): filled once a manual size has been
//     picked, regardless of whether any measurement was added — the pick
//     itself is the useful bit for a seller who doesn't need a size chart.
//     No partial state here: a manual size is a single atomic pick.
export function paramFillState(
  param: NecessityParam,
  kind: "regular" | "variant",
  options: VariantOption[],
  material: string,
  variantSizeValues: string[],
  sizeMeasurements: SizeMeasurements,
  manualSize: ManualSize | null,
  rows: VariantRow[],
  regularWeightGrams: number | null,
  linkedPostIds: string[],
): FillState {
  if (param === "Link content") return linkedPostIds.length > 0 ? "filled" : "empty";

  if (param === "Size") {
    if (variantSizeValues.length > 0) {
      const measuredCount = variantSizeValues.filter(
        (sv) => Object.keys(sizeMeasurements[sv] ?? {}).length > 0,
      ).length;
      if (measuredCount === 0) return "empty";
      if (measuredCount === variantSizeValues.length) return "filled";
      return "partial";
    }
    return manualSize !== null ? "filled" : "empty";
  }

  // Weight isn't a variant option axis the way Color/Size/Material are —
  // nobody picks "142g" as a buyer-facing choice — so it doesn't go through
  // the findOption(...) check below even for a variant product. Filled once
  // every selected row has its own weight set; partial once some (not all)
  // do; a regular product has exactly the one implicit "row", so it can
  // only ever be empty or filled.
  if (param === "Weight") {
    if (kind === "variant") {
      const selected = rows.filter((r) => r.selected);
      if (selected.length === 0) return "empty";
      const weighedCount = selected.filter((r) => r.weightGrams != null).length;
      if (weighedCount === 0) return "empty";
      if (weighedCount === selected.length) return "filled";
      return "partial";
    }
    return regularWeightGrams != null ? "filled" : "empty";
  }

  if (kind === "variant") {
    const opt = findOption(options, param);
    if (opt) return opt.values.length > 0 ? "filled" : "partial";
    // No option axis for it. Material still has somewhere real to live --
    // product_variants.material, a per-row column the form round-trips (see
    // store.products_.$id.tsx's load and product-save.ts's writes) -- so a
    // seller who answered "what's it made of" once from the Necessities
    // checklist satisfies this without being forced to turn Material into a
    // buyer-facing option axis they never wanted. Color has no equivalent
    // column anywhere, so for it the axis above is the only answer and
    // there's nothing to fall through to.
    if (param === "Material") {
      const selected = rows.filter((r) => r.selected);
      if (selected.length === 0) return "empty";
      const withMaterial = selected.filter((r) => r.material?.trim()).length;
      if (withMaterial === 0) return "empty";
      return withMaterial === selected.length ? "filled" : "partial";
    }
    return "empty";
  }
  // Color has no regular-product field at all -- paramsForCategory never
  // hands this branch "Color" for kind === "regular", so only Material
  // reaches here in practice.
  return param === "Material" && material.trim().length > 0 ? "filled" : "empty";
}

// Whether every necessity for this category is filled -- the single source
// of truth store.products_.new.tsx/store.products_.$id.tsx gate Save on, so
// the block can never drift from what NecessitiesSheet's own checklist shows.
//
// "Link content" is excluded from the required set while saving as a draft:
// it depends on a post/draft existing at all, which is entirely outside the
// product form's control (a brand-new seller with zero posts has no way to
// satisfy it, and a product form cannot be where someone is first funneled
// into making a post). It's still required to actually publish (status
// "active") — matching its own listed reason for existing ("a product isn't
// ready to publish without one"), and it still shows its live fill state in
// the checklist regardless of status, so linking is always visible as an
// option, just not a hard blocker for parking something as a draft.
export function allNecessitiesFilled(
  categoryPath: CategoryNode[],
  kind: "regular" | "variant",
  options: VariantOption[],
  material: string,
  sizeMeasurements: SizeMeasurements,
  manualSize: ManualSize | null,
  rows: VariantRow[],
  regularWeightGrams: number | null,
  linkedPostIds: string[],
  status: "draft" | "active",
): boolean {
  const allParams = paramsForCategory(categoryPath, kind);
  if (allParams.length === 0) return true;
  const params = status === "draft" ? allParams.filter((p) => p !== "Link content") : allParams;
  const variantSizeValues = findOption(options, "Size")?.values ?? [];
  return params.every(
    (p) =>
      paramFillState(
        p,
        kind,
        options,
        material,
        variantSizeValues,
        sizeMeasurements,
        manualSize,
        rows,
        regularWeightGrams,
        linkedPostIds,
      ) === "filled",
  );
}
