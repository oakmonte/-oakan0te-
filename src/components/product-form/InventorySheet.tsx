import { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight, Check, Plus } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { useLockedViewport } from "@/hooks/use-locked-viewport";
import { Code128Barcode } from "./Code128Barcode";
import { BarcodesSheet } from "./BarcodesSheet";
import type { BarcodeEntry } from "@/lib/barcode-types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type InventoryValues = {
  continueSellingOutOfStock: boolean;
  // locationId -> quantity available there. A location only appears here
  // once it's been picked in "Edit locations" -- absence means not stocked
  // at that location, not zero-and-tracked.
  locationQuantities: Record<string, number>;
  // Both per-SKU tracking identifiers, same as everything else in this
  // sheet -- live alongside stock rather than as their own top-level
  // sections, since they're all facets of "how this SKU is tracked."
  sku: string;
  // A SKU can carry more than one barcode (a custom one plus a
  // manufacturer's GTIN/UPC/EAN, say) -- edited in BarcodesSheet, not
  // typed directly here. See product_variant_barcodes.
  barcodes: BarcodeEntry[];
};

type StoreLocationOption = { id: string; name: string };

/** Per-SKU inventory editor -- one product_variants row's worth of stock
 *  (a "regular" product has exactly one implicit variant, so this same sheet
 *  covers both the base product page and each row in the variant matrix).
 *  Purely a local-state editor: it never writes to Supabase itself, mirroring
 *  every other field in this form -- the page-level Save is what persists
 *  everything at once. Locations themselves can only be created or edited
 *  from the store's Pickup locations screen (or the "Add pickup location"
 *  side-trip below); "Edit locations" here is otherwise selection-only. */
export function InventorySheet({
  productLabel,
  storeId,
  initial,
  onSave,
  onCreateLocation,
  initialLocationsPickerOpen,
  hideIdentifiers,
}: {
  productLabel?: string;
  storeId: string;
  initial: InventoryValues;
  onSave: (values: InventoryValues) => void;
  // Side-trips to /store/locations/new -- see store.locations_.new.tsx.
  // Takes the sheet's CURRENT in-progress values (not yet committed via
  // Save) so the caller can fold them into what it stashes before
  // navigating away -- otherwise whatever's been toggled/checked in this
  // still-open sheet is silently lost the moment "+" is tapped.
  onCreateLocation: (current: InventoryValues) => void;
  // Set when this sheet is reopening right after the seller created a new
  // pickup location from within "Edit locations" -- that's exactly where
  // they were, so land back there instead of on this sheet's own base view.
  initialLocationsPickerOpen?: boolean;
  // Set when this sheet is being used as the "apply to all" bulk editor
  // (see VariantCombinationsSheet) -- SKU and barcodes must stay unique per
  // variant, so there's nothing sensible to show or bulk-apply here.
  hideIdentifiers?: boolean;
}) {
  useLockedViewport();

  const [continueSellingOutOfStock, setContinueSellingOutOfStock] = useState(
    initial.continueSellingOutOfStock,
  );
  const [locationQuantities, setLocationQuantities] = useState<Record<string, number>>(
    initial.locationQuantities,
  );
  const [sku, setSku] = useState(initial.sku);
  const [barcodes, setBarcodes] = useState<BarcodeEntry[]>(initial.barcodes);
  const [barcodesSheetOpen, setBarcodesSheetOpen] = useState(false);
  const [locations, setLocations] = useState<StoreLocationOption[] | null>(null);
  const [locationsPickerOpen, setLocationsPickerOpen] = useState(
    () => !!initialLocationsPickerOpen,
  );
  // Gates the actual save behind a confirm when the seller's about to save
  // something that can't actually fulfil an order yet -- null means neither
  // condition tripped, save runs immediately.
  const [guardDialog, setGuardDialog] = useState<"no-locations" | "zero-stock" | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("store_locations")
      .select("id, name")
      .eq("store_id", storeId)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("InventorySheet: failed to load locations", error);
          setLocations([]);
          return;
        }
        setLocations(data ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  const selectedLocations = (locations ?? []).filter((l) => l.id in locationQuantities);
  const total = Object.values(locationQuantities).reduce((sum, n) => sum + n, 0);

  function setQuantity(locationId: string, qty: number) {
    setLocationQuantities((prev) => ({ ...prev, [locationId]: Math.max(0, qty) }));
  }

  function toggleLocation(locationId: string) {
    setLocationQuantities((prev) => {
      if (locationId in prev) {
        const next = { ...prev };
        delete next[locationId];
        return next;
      }
      return { ...prev, [locationId]: 0 };
    });
  }

  function handleSave() {
    if (selectedLocations.length === 0) {
      setGuardDialog("no-locations");
      return;
    }
    if (total === 0) {
      setGuardDialog("zero-stock");
      return;
    }
    onSave({ continueSellingOutOfStock, locationQuantities, sku, barcodes });
  }

  function confirmSaveAnyway() {
    setGuardDialog(null);
    onSave({ continueSellingOutOfStock, locationQuantities, sku, barcodes });
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col min-h-dvh animate-in fade-in slide-in-from-bottom-6 duration-300 ease-out">
      <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 px-4 pt-4 pb-3 flex flex-col items-center shrink-0 relative">
        <button
          // Commits, doesn't discard: BarcodesSheet and "Edit locations" both
          // now apply on their own X/Save (the seller sees "3 barcodes" the
          // instant they close that sub-sheet), so this X discarding those
          // same edits would silently undo something the seller just saw
          // confirmed. Nothing here writes to the DB either way -- Save/X
          // both only update this form's in-memory draft, same as every
          // other field, so there's no cost to always committing on close.
          onClick={handleSave}
          type="button"
          className="absolute left-4 top-4 p-1.5 rounded-full bg-gray-100 transition-transform duration-150 active:scale-90"
        >
          <X size={16} className="text-gray-600" />
        </button>
        <span className="font-semibold text-[16px] text-gray-900">Inventory details</span>
        {productLabel && <span className="text-xs text-gray-400 mt-0.5">{productLabel}</span>}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-3">
        <div className="flex items-center justify-between py-1">
          <span className="text-[15px] text-gray-900">Continue selling when out of stock</span>
          <Switch
            checked={continueSellingOutOfStock}
            onCheckedChange={setContinueSellingOutOfStock}
          />
        </div>

        {!hideIdentifiers && (
          <>
            <div className="-mx-4 h-2 bg-gray-50 mt-2" />

            <div className="pt-2">
              <span className="flex items-baseline gap-1.5">
                <span className="text-[15px] font-semibold text-gray-900">Identifiers</span>
                <span className="text-xs text-gray-400 font-normal">Optional</span>
              </span>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-gray-400">SKU</span>
                  <input
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="Optional"
                    className="text-base border border-gray-200 rounded-lg px-2 py-2 outline-none transition-colors duration-150 focus:border-gray-400"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setBarcodesSheetOpen(true)}
                  className="flex flex-col gap-1 text-left transition-transform duration-150 active:scale-[0.98]"
                >
                  <span className="text-xs text-gray-400">Barcode</span>
                  <span className="flex items-center justify-between border border-gray-200 rounded-lg px-2 py-2">
                    <span
                      className={`text-base truncate ${barcodes.length > 0 ? "text-gray-900" : "text-gray-400"}`}
                    >
                      {barcodes.length === 0
                        ? "Add"
                        : barcodes.length === 1
                          ? barcodes[0].value
                          : `${barcodes.length} barcodes`}
                    </span>
                    <ChevronRight size={14} className="text-gray-300 shrink-0" />
                  </span>
                </button>
              </div>
              {barcodes[0]?.value.trim() && (
                <Code128Barcode
                  value={barcodes[0].value.trim()}
                  className="mt-3 animate-in fade-in slide-in-from-top-1 duration-200"
                />
              )}
            </div>
          </>
        )}

        <div className="-mx-4 h-2 bg-gray-50 mt-2" />

        <div className="pt-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[15px] font-semibold text-gray-900">Quantity</span>
            <button
              type="button"
              onClick={() => setLocationsPickerOpen(true)}
              className="text-xs font-medium text-gray-600 border border-gray-200 rounded-full px-3 py-1.5 transition-transform duration-150 active:scale-95"
            >
              Edit locations
            </button>
          </div>
          <p className="text-xs text-gray-400 mb-4">
            {total} available · {selectedLocations.length} location
            {selectedLocations.length === 1 ? "" : "s"}
          </p>

          {selectedLocations.length === 0 ? (
            <p className="text-sm text-gray-400 py-4">
              No locations picked yet — tap "Edit locations" to choose where this is stocked.
            </p>
          ) : (
            <div className="flex flex-col">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <span className="text-xs text-gray-400">Location</span>
                <span className="text-xs text-gray-400">Available</span>
              </div>
              {selectedLocations.map((loc) => (
                <div
                  key={loc.id}
                  className="flex items-center justify-between py-3 border-b border-gray-50 animate-in fade-in slide-in-from-top-1 duration-200"
                >
                  <span className="text-[15px] text-gray-900">{loc.name}</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setQuantity(loc.id, (locationQuantities[loc.id] ?? 0) - 1)}
                      className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 transition-transform duration-150 active:scale-90"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={locationQuantities[loc.id] ?? 0}
                      onChange={(e) =>
                        setQuantity(loc.id, e.target.value === "" ? 0 : Number(e.target.value))
                      }
                      onFocus={(e) => e.target.select()}
                      aria-label={`${loc.name} quantity`}
                      className="w-12 text-center text-[15px] font-medium bg-gray-100 rounded-full py-1 outline-none transition-shadow duration-150 focus:ring-1 focus:ring-gray-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      onClick={() => setQuantity(loc.id, (locationQuantities[loc.id] ?? 0) + 1)}
                      className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 transition-transform duration-150 active:scale-90"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {locationsPickerOpen && (
        <InventoryLocationsPicker
          locations={locations ?? []}
          selectedIds={new Set(Object.keys(locationQuantities))}
          onToggle={toggleLocation}
          onClose={() => setLocationsPickerOpen(false)}
          onCreateLocation={() =>
            onCreateLocation({ continueSellingOutOfStock, locationQuantities, sku, barcodes })
          }
        />
      )}

      {barcodesSheetOpen && (
        <BarcodesSheet
          productLabel={productLabel}
          initial={barcodes}
          onClose={(next) => {
            setBarcodes(next);
            setBarcodesSheetOpen(false);
          }}
        />
      )}

      <div className="sticky bottom-0 px-4 pt-3 oak-safe-bottom border-t border-gray-100 bg-white shrink-0">
        <button
          type="button"
          onClick={handleSave}
          className="w-full bg-black text-white text-sm font-medium rounded-full py-3.5 transition-transform duration-150 active:scale-[0.98]"
        >
          Save
        </button>
      </div>

      <AlertDialog
        open={guardDialog !== null}
        onOpenChange={(open) => !open && setGuardDialog(null)}
      >
        <AlertDialogContent className="max-w-[92vw] rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {guardDialog === "no-locations"
                ? "You can't make sales without adding a store or warehouse location"
                : "You're saving this with 0 in stock — are you sure?"}
            </AlertDialogTitle>
            {guardDialog === "no-locations" && (
              <AlertDialogDescription>
                We won't know where the rider should pick the product from.
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Go back</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSaveAnyway} className="bg-black rounded-full">
              Continue anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Picking an *existing* location only -- creating one happens on its own
// route (see the empty-state CTA and header "+" below), mirroring
// CollectionsSheet's pattern for the same reason.
function InventoryLocationsPicker({
  locations,
  selectedIds,
  onToggle,
  onClose,
  onCreateLocation,
}: {
  locations: StoreLocationOption[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onClose: () => void;
  onCreateLocation: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col min-h-dvh animate-in fade-in slide-in-from-bottom-6 duration-300 ease-out">
      <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 px-4 h-14 flex items-center justify-between shrink-0">
        <button
          onClick={onClose}
          className="p-1 -ml-1 transition-transform duration-150 active:scale-90"
          type="button"
        >
          <ChevronLeft size={22} />
        </button>
        <span className="font-semibold text-[15px] absolute left-1/2 -translate-x-1/2">
          Edit locations
        </span>
        <button
          onClick={onCreateLocation}
          type="button"
          aria-label="Add pickup location"
          className="p-1 -mr-1 transition-transform duration-150 active:scale-90"
        >
          <Plus size={20} className="text-gray-900" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-8">
        {locations.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-8 py-12 text-center">
            <p className="text-[15px] text-gray-400">No pickup locations yet</p>
            <button
              type="button"
              onClick={onCreateLocation}
              className="bg-black text-white text-sm font-medium rounded-full px-5 py-2.5 transition-transform duration-150 active:scale-[0.97]"
            >
              Add pickup location
            </button>
          </div>
        ) : (
          locations.map((loc) => {
            const checked = selectedIds.has(loc.id);
            return (
              <button
                key={loc.id}
                type="button"
                onClick={() => onToggle(loc.id)}
                className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-gray-50 text-left transition-colors duration-150 active:bg-gray-50"
              >
                <span
                  className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors duration-150 ${
                    checked ? "bg-black border-black" : "border-gray-300 bg-white"
                  }`}
                >
                  {checked && <Check size={13} className="text-white oak-motion-pop" />}
                </span>
                <span className="text-[15px] text-gray-900">{loc.name}</span>
              </button>
            );
          })
        )}
      </div>

      {locations.length > 0 && (
        <div className="sticky bottom-0 px-4 pt-3 oak-safe-bottom border-t border-gray-100 bg-white shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full bg-black text-white text-sm font-medium rounded-full py-3.5 transition-transform duration-150 active:scale-[0.98]"
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}
