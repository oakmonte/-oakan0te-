// In-memory-only handoff for the "create collection" side-trip out of the new-product
// form. Client-side navigation never reloads the page, so a module variable survives
// store.products/new -> store.collections/new -> back, the same tradeoff as
// capture-handoff.ts. Known limitation: a hard refresh on either leg loses this.
import { CategoryNode } from "@/lib/categories";
import { VariantOption, VariantRow } from "@/components/product-form/VariantMatrixBuilder";
import { ManualSize, SizeMeasurements } from "@/lib/size-chart-config";
import { BarcodeEntry } from "@/lib/barcode-types";
import { InventoryValues } from "@/components/product-form/InventorySheet";

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
  linkedPostIds?: string[];
  regularBarcodes?: BarcodeEntry[];
  regularMaterialFeel?: string | null;
  regularLegacyStockQty?: number;
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
// entry point inside the Inventory sheet's location picker.
export function setPendingNewLocationId(id: string) {
  pendingNewLocationId = id;
}

export function takePendingNewLocationId(): string | null {
  const id = pendingNewLocationId;
  pendingNewLocationId = null;
  return id;
}

// Which Inventory sheet to reopen on return, for the variant wizard's
// "Add pickup location" side-trip -- a variant row's (or the bulk "Apply to
// all" box's) Inventory sheet is nested several levels deep (Variants ->
// combinations step -> Inventory sheet -> Edit locations), all of it local
// component state that a full page remount would otherwise drop, landing
// the seller back on the collapsed product form instead of where they were.
// Paired with the new location id above (already captured the same way) to
// pre-check it and jump straight back to Edit locations.
//
// `pending` carries whatever the seller had already toggled/checked in that
// Inventory sheet BEFORE tapping "Add pickup location" -- continueSelling/
// locationQuantities/sku/barcodes only ever reach the page's own `rows` (and
// therefore the stashed draft below) via that sheet's own Save button, which
// hasn't fired yet at this point. Without threading it through here,
// handleCreateLocation's stashProductDraft(currentDraft()) snapshots the
// PAGE's still-stale copy of this row and silently drops every edit made in
// the sheet during this session -- a real, shipped bug (tapping "+" after
// checking a couple of locations came back with only the brand new one
// checked, and any stock/toggle changes gone).
export type VariantInventoryContext =
  | { kind: "bulk"; pending: InventoryValues }
  | { kind: "row"; rowKey: string; pending: InventoryValues };

let pendingVariantInventoryContext: VariantInventoryContext | null = null;

export function setPendingVariantInventoryContext(context: VariantInventoryContext) {
  pendingVariantInventoryContext = context;
}

export function takePendingVariantInventoryContext(): VariantInventoryContext | null {
  const context = pendingVariantInventoryContext;
  pendingVariantInventoryContext = null;
  return context;
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

// Bump whenever ProductDraft's shape changes in a way an older draft can't
// safely fill gaps for -- e.g. regularBarcode (string) becoming
// regularBarcodes (BarcodeEntry[]): a draft written under the old shape
// still has the old field name, so reading it back under the new type finds
// nothing and looks exactly like "the seller never touched barcodes",
// silently wiping real ones on the next save instead of round-tripping
// them. A version mismatch is discarded the same way a missing/expired
// savedAt is -- forces a real DB load instead of trusting a shape this
// build can no longer interpret correctly.
const AUTOSAVE_SCHEMA_VERSION = 3;

function autosaveKey(productId: string | undefined) {
  return AUTOSAVE_KEY_PREFIX + (productId ?? "new");
}

export function writeAutosavedDraft(productId: string | undefined, draft: ProductDraft) {
  try {
    const stamped: ProductDraft & { savedAt: number; schemaVersion: number } = {
      ...draft,
      savedAt: Date.now(),
      schemaVersion: AUTOSAVE_SCHEMA_VERSION,
    };
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
    const parsed = JSON.parse(raw) as ProductDraft & {
      savedAt?: number;
      schemaVersion?: number;
    };
    // No savedAt/schemaVersion at all means this was written before those
    // stamps existed, and a version mismatch means it predates a shape
    // change since — either way, treat it the same as expired rather than
    // trusting it, so a stale draft never silently wipes a field it was
    // written before this build knew to track.
    if (
      parsed.savedAt == null ||
      parsed.schemaVersion !== AUTOSAVE_SCHEMA_VERSION ||
      Date.now() - parsed.savedAt > AUTOSAVE_MAX_AGE_MS
    ) {
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
