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
  material: string;
  options: VariantOption[];
  rows: VariantRow[];
  collectionIds: string[];
  sizeMeasurements: SizeMeasurements;
  manualSize: ManualSize | null;
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
