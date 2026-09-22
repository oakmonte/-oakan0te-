import { useEffect, useState } from "react";
import { X, MapPin, Plus, ChevronRight } from "lucide-react";
import { useLockedViewport } from "@/hooks/use-locked-viewport";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { LocationSheet, type StoreLocationValues } from "./LocationSheet";

type Row = {
  id: string;
  name: string;
  addressLine: string;
  addressLine2: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  lat: number | null;
  lng: number | null;
};

function toValues(row: Row): StoreLocationValues {
  return { ...row };
}

/** Full-screen list of every pickup/dispatch location the store has saved --
 *  for sellers running more than one store or warehouse, so riders can be
 *  sent to whichever one actually has the item. Tapping a row or "Add
 *  location" opens LocationSheet stacked on top for add/edit/delete; this
 *  sheet owns the actual read/write against store_locations. */
export function LocationsListSheet({
  storeId,
  onClose,
  onCountChange,
  fromChecklist = false,
}: {
  storeId: string;
  onClose: () => void;
  onCountChange?: (count: number) => void;
  /** True when this sheet was opened from the "Pickup locations" card on the
   *  store setup checklist (store.index.tsx) — mirrors the `checklist` search
   *  param the other three steps use, just as a prop since this one is a
   *  sheet over that same page rather than its own route. Surfaces a Next
   *  button matching those other steps', so this step doesn't feel like a
   *  dead end back to "just close it" the way it did before. */
  fromChecklist?: boolean;
}) {
  useLockedViewport();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [editing, setEditing] = useState<StoreLocationValues | null | "new">(null);
  // How many variant-stock rows sit at the location currently being edited --
  // product_variant_stock.location_id cascades on delete, so removing a
  // location silently takes every one of these with it. Fetched fresh each
  // time an existing location opens (null while loading, so the confirm
  // dialog can tell "still checking" apart from "genuinely zero").
  const [affectedStockCount, setAffectedStockCount] = useState<number | null>(null);

  useEffect(() => {
    if (!editing || editing === "new" || !editing.id) {
      setAffectedStockCount(null);
      return;
    }
    let cancelled = false;
    setAffectedStockCount(null);
    supabase
      .from("product_variant_stock")
      .select("id", { count: "exact", head: true })
      .eq("location_id", editing.id)
      .then(({ count, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("LocationsListSheet: failed to count affected stock rows", error);
          return;
        }
        setAffectedStockCount(count ?? 0);
      });
    return () => {
      cancelled = true;
    };
  }, [editing]);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("store_locations")
      .select("id, name, address_line, address_line2, city, state, country, postal_code, lat, lng")
      .eq("store_id", storeId)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("LocationsListSheet: failed to load locations", error);
          setRows([]);
          return;
        }
        setRows(
          (data ?? []).map((r) => ({
            id: r.id,
            name: r.name,
            addressLine: r.address_line ?? "",
            addressLine2: r.address_line2 ?? "",
            city: r.city ?? "",
            state: r.state ?? "",
            country: r.country ?? "",
            postalCode: r.postal_code ?? "",
            lat: r.lat,
            lng: r.lng,
          })),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  useEffect(() => {
    if (rows) onCountChange?.(rows.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  async function handleSave(values: StoreLocationValues) {
    const payload = {
      store_id: storeId,
      name: values.name,
      address_line: values.addressLine || null,
      address_line2: values.addressLine2 || null,
      city: values.city || null,
      state: values.state || null,
      country: values.country || null,
      postal_code: values.postalCode || null,
      lat: values.lat,
      lng: values.lng,
    };

    if (values.id) {
      const { error } = await supabase.from("store_locations").update(payload).eq("id", values.id);
      if (error) {
        console.error("LocationsListSheet: failed to update location", error);
        return;
      }
      setRows(
        (prev) =>
          prev?.map((r) => (r.id === values.id ? { ...values, id: values.id! } : r)) ?? prev,
      );
    } else {
      const { data, error } = await supabase
        .from("store_locations")
        .insert(payload)
        .select("id")
        .single();
      if (error) {
        console.error("LocationsListSheet: failed to add location", error);
        return;
      }
      setRows((prev) => [...(prev ?? []), { ...values, id: data.id }]);
    }
    setEditing(null);
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from("store_locations").delete().eq("id", id);
    if (error) {
      console.error("LocationsListSheet: failed to delete location", error);
      return;
    }
    setRows((prev) => prev?.filter((r) => r.id !== id) ?? prev);
    setEditing(null);
  }

  return (
    <div className="fixed inset-0 z-50 bg-sd-surface flex flex-col min-h-dvh animate-in fade-in slide-in-from-bottom-6 duration-300 ease-out">
      <div className="sticky top-0 bg-sd-surface/95 backdrop-blur border-b border-sd-line px-4 h-14 flex items-center justify-between shrink-0">
        <button onClick={onClose} type="button" className="p-1 -ml-1">
          <X size={20} className="text-sd-ink-muted" />
        </button>
        <span className="font-semibold text-[15px] absolute left-1/2 -translate-x-1/2">
          Pickup locations
        </span>
        <span className="w-5" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <p className="text-xs text-sd-ink-muted mb-5">
          Add a location for every store or warehouse you dispatch from. If you have more than one,
          riders can be sent to whichever one has the product.
        </p>

        {rows === null ? (
          <div className="flex flex-col gap-3">
            <div className="h-20 rounded-2xl bg-sd-elevated animate-pulse" />
            <div className="h-20 rounded-2xl bg-sd-elevated animate-pulse" />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {rows.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => setEditing(toValues(row))}
                className="flex items-start gap-3 border border-sd-line rounded-2xl p-4 text-left hover:bg-sd-elevated oak-motion-control"
              >
                <div className="p-2 rounded-full bg-sd-soft shrink-0">
                  <MapPin size={16} className="text-sd-ink" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-sd-ink">{row.name}</p>
                  <p className="text-xs text-sd-ink-muted mt-0.5 truncate">
                    {[row.addressLine, row.city, row.state].filter(Boolean).join(", ")}
                  </p>
                </div>
                <ChevronRight size={16} className="text-sd-ink-faint shrink-0 mt-1.5" />
              </button>
            ))}

            <button
              type="button"
              onClick={() => setEditing("new")}
              className="flex items-center gap-3 border-2 border-dashed border-sd-line rounded-2xl p-4 text-left oak-motion-control"
            >
              <div className="p-2 rounded-full bg-sd-soft shrink-0">
                <Plus size={16} className="text-sd-ink-muted" />
              </div>
              <p className="text-sm font-medium text-sd-ink">
                {rows.length === 0 ? "Add your first location" : "Add another location"}
              </p>
            </button>
          </div>
        )}
      </div>

      {fromChecklist && (
        <div className="sticky bottom-0 px-4 pt-3 oak-safe-bottom border-t border-sd-line bg-sd-surface shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full bg-sd-ink text-sd-bg text-sm font-semibold rounded-full py-4 oak-motion-control active:scale-[0.98]"
          >
            Next
          </button>
        </div>
      )}

      {editing && (
        <LocationSheet
          initial={editing === "new" ? null : editing}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setEditing(null)}
          affectedStockCount={affectedStockCount}
        />
      )}
    </div>
  );
}
