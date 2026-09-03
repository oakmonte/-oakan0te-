// In-memory-only handoff for the "create collection" side-trip out of the new-product
// form. Client-side navigation never reloads the page, so a module variable survives
// store.products/new -> store.collections/new -> back, the same tradeoff as
// capture-handoff.ts. Known limitation: a hard refresh on either leg loses this.
import { CategoryNode } from "@/lib/categories";
import { VariantOption, VariantRow } from "@/components/product-form/VariantMatrixBuilder";
import { ManualSize, SizeMeasurements } from "@/lib/size-chart-config";

export type ProductDraft = {
  // Set only when the draft was stashed from the edit page, not the new-product
  // page — the collection side-trip needs to know which screen to return to,
  // and whether to UPDATE that product's row instead of creating one.
  productId?: string;
  kind: "regular" | "variant";
  status: "draft" | "active";
  mainImageUrl: string;
  additionalImageUrls?: string[] | null;
  title: string;
  descriptionShort: string;
  categoryPath: CategoryNode[];
  price: string;
  compareAtPrice: string;
  costPrice: string;
  stockQty: number;
  regularContinueSellingOutOfStock: boolean;
  regularLocationQuantities: Record<string, number>;
  regularWeightGrams: number | null;
  regularSku: string;
  material: string;
  options: VariantOption[];
  rows: VariantRow[];
  collectionIds: string[];
  sizeMeasurements: SizeMeasurements;
  manualSize: ManualSize | null;
  // Optional because drafts written before these fields existed are still
  // sitting in some sellers' localStorage — `?? []`/`?? null` at every read
  // site treats a missing value as "the draft never touched this", not as
  // "clear it". Only the edit page ($id.tsx) tracks regularMaterialFeel; the
  // new-product page has no such field to lose.
  tagIds?: string[];
  regularBarcode?: string | null;
  regularMaterialFeel?: string | null;
};

let pendingDraft: ProductDraft | null = null;
let pendingNewCollectionId: string | null = null;
let pendingNewLocationId: string | null = null;

export function stashProductDraft(draft: ProductDraft) {
  pendingDraft = draft;
}

export function takeProductDraft(): ProductDraft | null {
  const draft = pendingDraft;
  pendingDraft = null;
  return draft;
}

export function hasPendingProductDraft() {
  return pendingDraft !== null;
}

/** Peeks the stashed draft's productId without consuming the draft — lets the
 *  collections page decide where "back" goes before the destination page
 *  itself calls takeProductDraft(). */
export function peekPendingProductDraftId(): string | null {
  return pendingDraft?.productId ?? null;
}

export function setPendingNewCollectionId(id: string) {
  pendingNewCollectionId = id;
}

export function takePendingNewCollectionId(): string | null {
  const id = pendingNewCollectionId;
  pendingNewCollectionId = null;
  return id;
}

// Same side-trip pattern as collections, for the "Add pickup location"
// entry point inside the Inventory sheet's location picker. Only the
// regular-product page auto-selects the new location on return (its
// Inventory state is top-level); a variant row's Inventory sheet is nested
// several levels deep in the wizard, so for now the new location just shows
// up next time that row's Edit Locations is opened.
export function setPendingNewLocationId(id: string) {
  pendingNewLocationId = id;
}

export function takePendingNewLocationId(): string | null {
  const id = pendingNewLocationId;
  pendingNewLocationId = null;
  return id;
}

// Autosave, separate from the in-memory handoff above: that one only
// survives client-side navigation (a module variable, wiped by any hard
// refresh); this persists to localStorage so a refresh -- or closing the
// tab entirely -- doesn't lose an in-progress listing. Keyed by productId so
// editing product A can't clobber an untouched autosave for product B; the
// new-product page (no id yet) always uses one shared "new" slot, same
// single-in-progress-draft assumption the in-memory handoff already makes.
const AUTOSAVE_KEY_PREFIX = "oak_product_draft_autosave:";

// How long an autosave is trusted before it's treated as abandoned rather
// than "unsaved progress" — long enough to survive an accidental refresh or
// a short interruption, short enough that a forgotten tab doesn't silently
// resurrect a stale, since-superseded edit (and the DB fields it never
// tracked, like tags) days or weeks later.
const AUTOSAVE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

function autosaveKey(productId: string | undefined) {
  return AUTOSAVE_KEY_PREFIX + (productId ?? "new");
}

export function writeAutosavedDraft(productId: string | undefined, draft: ProductDraft) {
  try {
    const stamped: ProductDraft & { savedAt: number } = { ...draft, savedAt: Date.now() };
    localStorage.setItem(autosaveKey(productId), JSON.stringify(stamped));
  } catch {
    // Storage full or unavailable (Safari private browsing, etc.) — the
    // draft just won't survive a refresh this time, nothing else to do.
  }
}

export function readAutosavedDraft(productId: string | undefined): ProductDraft | null {
  try {
    const raw = localStorage.getItem(autosaveKey(productId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProductDraft & { savedAt?: number };
    // No savedAt at all means this was written before that stamp existed —
    // treat it the same as expired rather than trusting it indefinitely, so
    // a pre-fix draft missing tagIds/regularBarcode/regularMaterialFeel gets
    // discarded (forcing a real DB load) instead of silently wiping those
    // fields on the next save.
    if (parsed.savedAt == null || Date.now() - parsed.savedAt > AUTOSAVE_MAX_AGE_MS) {
      clearAutosavedDraft(productId);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearAutosavedDraft(productId: string | undefined) {
  try {
    localStorage.removeItem(autosaveKey(productId));
  } catch {
    // Nothing to do if storage itself is unavailable.
  }
}
