import { useEffect, useState } from "react";
import { X, MapPin, LocateFixed, ChevronRight } from "lucide-react";
import { useLockedViewport } from "@/hooks/use-locked-viewport";

export type PickupLocationValues = {
  addressLine: string;
  city: string;
  state: string;
  country: string;
  lat: number | null;
  lng: number | null;
};

// No paid geocoding provider is wired up yet (no Mapbox/Google Maps key in
// env) -- Nominatim's free reverse endpoint is a placeholder that's fine at
// this volume (one lookup per seller tap, not bulk/automated) but should
// move to a paid provider before this needs to hold up at scale.
async function reverseGeocode(lat: number, lng: number) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
    { headers: { Accept: "application/json" } },
  );
  if (!res.ok) return null;
  const data = await res.json();
  const addr = data.address ?? {};
  return {
    addressLine:
      [addr.house_number, addr.road].filter(Boolean).join(" ") ||
      (data.display_name as string | undefined)?.split(",")[0] ||
      "",
    city: addr.city || addr.town || addr.village || addr.county || "",
    state: addr.state || "",
    country: addr.country || "",
  };
}

/** Full-screen sheet for the store's pickup/dispatch location. Opens straight
 *  to the manual address form, and a beat later surfaces a "use current
 *  location" prompt on top of it -- accepting that just fills the same
 *  fields (still editable) and captures the exact lat/lng pin riders need,
 *  it never replaces manual entry. */
export function LocationSheet({
  initial,
  onSave,
  onClose,
}: {
  initial: PickupLocationValues | null;
  onSave: (values: PickupLocationValues) => Promise<void>;
  onClose: () => void;
}) {
  useLockedViewport();

  const [addressLine, setAddressLine] = useState(initial?.addressLine ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [state, setState] = useState(initial?.state ?? "");
  const [country, setCountry] = useState(initial?.country ?? "");
  const [lat, setLat] = useState<number | null>(initial?.lat ?? null);
  const [lng, setLng] = useState<number | null>(initial?.lng ?? null);

  const [promptVisible, setPromptVisible] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setPromptVisible(true), 350);
    return () => clearTimeout(t);
  }, []);

  function useCurrentLocation() {
    if (!("geolocation" in navigator)) {
      setLocateError("Location isn't available on this device.");
      return;
    }
    setLocating(true);
    setLocateError("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setLat(latitude);
        setLng(longitude);
        const geocoded = await reverseGeocode(latitude, longitude).catch(() => null);
        if (geocoded) {
          setAddressLine((v) => v || geocoded.addressLine);
          setCity((v) => v || geocoded.city);
          setState((v) => v || geocoded.state);
          setCountry((v) => v || geocoded.country);
        }
        setLocating(false);
        setPromptVisible(false);
      },
      (err) => {
        setLocating(false);
        setLocateError(
          err.code === err.PERMISSION_DENIED
            ? "Location access was denied — you can still fill this in by hand."
            : "Couldn't get your location — you can still fill this in by hand.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  const valid = city.trim().length > 0 && country.trim().length > 0;

  async function handleSave() {
    if (!valid) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    try {
      await onSave({
        addressLine: addressLine.trim(),
        city: city.trim(),
        state: state.trim(),
        country: country.trim(),
        lat,
        lng,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col min-h-dvh animate-in fade-in slide-in-from-bottom-6 duration-300 ease-out">
      <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 px-4 h-14 flex items-center justify-between shrink-0">
        <button onClick={onClose} type="button" className="p-1 -ml-1">
          <X size={20} className="text-gray-500" />
        </button>
        <span className="font-semibold text-[15px] absolute left-1/2 -translate-x-1/2">
          Pickup location
        </span>
        <span className="w-5" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-6">
        {promptVisible && (
          <div className="border border-gray-200 rounded-2xl p-4 flex items-start gap-3 bg-gray-50 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="p-2 rounded-full bg-white border border-gray-200 shrink-0">
              <LocateFixed size={16} className="text-gray-700" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">Use my current location</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Fills the form below and saves the exact pin riders use to find you — you can still
                edit everything before saving.
              </p>
              {locateError && <p className="text-xs text-red-500 mt-1.5">{locateError}</p>}
              <div className="flex items-center gap-3 mt-2.5">
                <button
                  type="button"
                  onClick={useCurrentLocation}
                  disabled={locating}
                  className="text-xs font-medium text-white bg-black rounded-full px-3.5 py-1.5 disabled:opacity-50"
                >
                  {locating ? "Locating…" : "Use current location"}
                </button>
                <button
                  type="button"
                  onClick={() => setPromptVisible(false)}
                  className="text-xs font-medium text-gray-500"
                >
                  Enter manually
                </button>
              </div>
            </div>
          </div>
        )}

        <div>
          <p className="text-[15px] font-semibold text-gray-900 mb-3">Address</p>
          <div className="flex flex-col gap-3">
            <input
              value={addressLine}
              onChange={(e) => setAddressLine(e.target.value)}
              placeholder="Street address (optional)"
              className="w-full text-base border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-gray-400 transition-colors duration-150"
            />
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City"
              className={`w-full text-base border rounded-xl px-4 py-3 outline-none focus:border-gray-400 transition-colors duration-150 ${
                showErrors && !city.trim() ? "border-red-300" : "border-gray-200"
              }`}
            />
            <input
              value={state}
              onChange={(e) => setState(e.target.value)}
              placeholder="State (optional)"
              className="w-full text-base border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-gray-400 transition-colors duration-150"
            />
            <input
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="Country"
              className={`w-full text-base border rounded-xl px-4 py-3 outline-none focus:border-gray-400 transition-colors duration-150 ${
                showErrors && !country.trim() ? "border-red-300" : "border-gray-200"
              }`}
            />
          </div>
          {showErrors && !valid && (
            <p className="text-xs text-red-500 mt-2">City and country are required.</p>
          )}
        </div>

        {lat != null && lng != null && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <MapPin size={13} className="text-gray-400 shrink-0" />
            Exact pin saved ({lat.toFixed(5)}, {lng.toFixed(5)}) — riders use this to find you.
          </div>
        )}

        <p className="text-xs text-gray-500 flex items-start gap-1.5">
          <ChevronRight size={13} className="text-gray-300 shrink-0 mt-0.5" />
          Only riders dispatching your orders (and you, at checkout as a buyer) see this. Curators
          and creators never do.
        </p>
      </div>

      <div className="sticky bottom-0 px-4 py-3 border-t border-gray-100 bg-white shrink-0">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-black text-white text-sm font-medium rounded-full py-3.5 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save location"}
        </button>
      </div>
    </div>
  );
}
