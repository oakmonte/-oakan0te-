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
}: {
  storeId: string;
  onClose: () => void;
  onCountChange?: (count: number) => void;
}) {
  useLockedViewport();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [editing, setEditing] = useState<StoreLocationValues | null | "new">(null);

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
    <div className="fixed inset-0 z-50 bg-white flex flex-col min-h-dvh animate-in fade-in slide-in-from-bottom-6 duration-300 ease-out">
      <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 px-4 h-14 flex items-center justify-between shrink-0">
        <button onClick={onClose} type="button" className="p-1 -ml-1">
          <X size={20} className="text-gray-500" />
        </button>
        <span className="font-semibold text-[15px] absolute left-1/2 -translate-x-1/2">
          Pickup locations
        </span>
        <span className="w-5" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <p className="text-xs text-gray-500 mb-5">
          Add a location for every store or warehouse you dispatch from. If you have more than one,
          riders can be sent to whichever one has the product.
        </p>

        {rows === null ? (
          <div className="flex flex-col gap-3">
            <div className="h-20 rounded-2xl bg-gray-50 animate-pulse" />
            <div className="h-20 rounded-2xl bg-gray-50 animate-pulse" />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {rows.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => setEditing(toValues(row))}
                className="flex items-start gap-3 border border-gray-200 rounded-2xl p-4 text-left hover:bg-gray-50 oak-motion-control"
              >
                <div className="p-2 rounded-full bg-gray-100 shrink-0">
                  <MapPin size={16} className="text-gray-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{row.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {[row.addressLine, row.city, row.state].filter(Boolean).join(", ")}
                  </p>
                </div>
                <ChevronRight size={16} className="text-gray-300 shrink-0 mt-1.5" />
              </button>
            ))}

            <button
              type="button"
              onClick={() => setEditing("new")}
              className="flex items-center gap-3 border-2 border-dashed border-gray-300 rounded-2xl p-4 text-left oak-motion-control"
            >
              <div className="p-2 rounded-full bg-gray-100 shrink-0">
                <Plus size={16} className="text-gray-500" />
              </div>
              <p className="text-sm font-medium text-gray-700">
                {rows.length === 0 ? "Add your first location" : "Add another location"}
              </p>
            </button>
          </div>
        )}
      </div>

      {editing && (
        <LocationSheet
          initial={editing === "new" ? null : editing}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
