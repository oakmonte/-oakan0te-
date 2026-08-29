import { useEffect, useState } from "react";
import { X, ChevronLeft, Check, Plus } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { useLockedViewport } from "@/hooks/use-locked-viewport";

export type InventoryValues = {
  continueSellingOutOfStock: boolean;
  // locationId -> quantity available there. A location only appears here
  // once it's been picked in "Edit locations" -- absence means not stocked
  // at that location, not zero-and-tracked.
  locationQuantities: Record<string, number>;
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
  onClose,
  onCreateLocation,
}: {
  productLabel?: string;
  storeId: string;
  initial: InventoryValues;
  onSave: (values: InventoryValues) => void;
  onClose: () => void;
  // Side-trips to /store/locations/new -- see store.locations_.new.tsx.
  onCreateLocation: () => void;
}) {
  useLockedViewport();

  const [continueSellingOutOfStock, setContinueSellingOutOfStock] = useState(
    initial.continueSellingOutOfStock,
  );
  const [locationQuantities, setLocationQuantities] = useState<Record<string, number>>(
    initial.locationQuantities,
  );
  const [locations, setLocations] = useState<StoreLocationOption[] | null>(null);
  const [locationsPickerOpen, setLocationsPickerOpen] = useState(false);

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
    onSave({ continueSellingOutOfStock, locationQuantities });
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col min-h-dvh animate-in fade-in slide-in-from-bottom-6 duration-300 ease-out">
      <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 px-4 pt-4 pb-3 flex flex-col items-center shrink-0 relative">
        <button
          onClick={onClose}
          type="button"
          className="absolute left-4 top-4 p-1.5 rounded-full bg-gray-100"
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

        <div className="-mx-4 h-2 bg-gray-50 mt-2" />

        <div className="pt-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[15px] font-semibold text-gray-900">Quantity</span>
            <button
              type="button"
              onClick={() => setLocationsPickerOpen(true)}
              className="text-xs font-medium text-gray-600 border border-gray-200 rounded-full px-3 py-1.5"
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
                  className="flex items-center justify-between py-3 border-b border-gray-50"
                >
                  <span className="text-[15px] text-gray-900">{loc.name}</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setQuantity(loc.id, (locationQuantities[loc.id] ?? 0) - 1)}
                      className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600"
                    >
                      −
                    </button>
                    <span className="w-10 text-center text-[15px] font-medium bg-gray-100 rounded-full py-1">
                      {locationQuantities[loc.id] ?? 0}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity(loc.id, (locationQuantities[loc.id] ?? 0) + 1)}
                      className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600"
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
          onCreateLocation={onCreateLocation}
        />
      )}

      <div className="sticky bottom-0 px-4 py-3 border-t border-gray-100 bg-white shrink-0">
        <button
          type="button"
          onClick={handleSave}
          className="w-full bg-black text-white text-sm font-medium rounded-full py-3.5"
        >
          Save
        </button>
      </div>
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
        <button onClick={onClose} className="p-1 -ml-1" type="button">
          <ChevronLeft size={22} />
        </button>
        <span className="font-semibold text-[15px] absolute left-1/2 -translate-x-1/2">
          Edit locations
        </span>
        <button
          onClick={onCreateLocation}
          type="button"
          aria-label="Add pickup location"
          className="p-1 -mr-1"
        >
          <Plus size={20} className="text-gray-900" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {locations.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-8 py-12 text-center">
            <p className="text-[15px] text-gray-400">No pickup locations yet</p>
            <button
              type="button"
              onClick={onCreateLocation}
              className="bg-black text-white text-sm font-medium rounded-full px-5 py-2.5"
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
                className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-gray-50 text-left"
              >
                <span
                  className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                    checked ? "bg-black border-black" : "border-gray-300 bg-white"
                  }`}
                >
                  {checked && <Check size={13} className="text-white" />}
                </span>
                <span className="text-[15px] text-gray-900">{loc.name}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
