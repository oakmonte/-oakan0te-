// In-memory-only handoff for the "create collection" side-trip out of the new-product
// form. Client-side navigation never reloads the page, so a module variable survives
// store.products/new -> store.collections/new -> back, the same tradeoff as
// capture-handoff.ts. Known limitation: a hard refresh on either leg loses this.
import { CategoryNode } from "@/lib/categories";
import { VariantOption, VariantRow } from "@/components/product-form/VariantMatrixBuilder";
import { ManualSize, SizeMeasurements } from "@/lib/size-chart-config";

export type ProductDraft = {
  kind: "regular" | "variant";
  status: "draft" | "active";
  mainImageUrl: string;
  title: string;
  descriptionShort: string;
  categoryPath: CategoryNode[];
  price: string;
  compareAtPrice: string;
  costPrice: string;
  stockQty: number;
  material: string;
  options: VariantOption[];
  rows: VariantRow[];
  collectionIds: string[];
  sizeMeasurements: SizeMeasurements;
  manualSize: ManualSize | null;
};

let pendingDraft: ProductDraft | null = null;
let pendingNewCollectionId: string | null = null;

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

export function setPendingNewCollectionId(id: string) {
  pendingNewCollectionId = id;
}

export function takePendingNewCollectionId(): string | null {
  const id = pendingNewCollectionId;
  pendingNewCollectionId = null;
  return id;
}
