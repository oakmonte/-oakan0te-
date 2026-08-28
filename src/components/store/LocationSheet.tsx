import { useEffect, useMemo, useState } from "react";
import { X, MapPin, LocateFixed, ChevronRight } from "lucide-react";
import { Country, State, City } from "country-state-city";
import { useLockedViewport } from "@/hooks/use-locked-viewport";
import { LocationListPicker, type LocationListItem } from "./LocationListPicker";

export type PickupLocationValues = {
  addressLine: string;
  addressLine2: string;
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
  const [addressLine2, setAddressLine2] = useState(initial?.addressLine2 ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [state, setState] = useState(initial?.state ?? "");
  const [country, setCountry] = useState(initial?.country ?? "");
  const [lat, setLat] = useState<number | null>(initial?.lat ?? null);
  const [lng, setLng] = useState<number | null>(initial?.lng ?? null);

  // isoCodes drive the country -> state -> city cascade; the saved values
  // stay plain names (matches existing DB rows and avoids a schema change).
  // Seeded from the saved name on mount so editing an existing location
  // still shows the right cascade -- falls back to unmatched (no code) for
  // older free-text rows that don't line up with the dataset, which just
  // means re-picking that field replaces it.
  const [countryCode, setCountryCode] = useState<string>(
    () => Country.getAllCountries().find((c) => c.name === initial?.country)?.isoCode ?? "",
  );
  const [stateCode, setStateCode] = useState<string>(
    () =>
      (countryCode &&
        State.getStatesOfCountry(countryCode).find((s) => s.name === initial?.state)?.isoCode) ||
      "",
  );

  const [pickerOpen, setPickerOpen] = useState<"country" | "state" | "city" | null>(null);
  const [promptVisible, setPromptVisible] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const countryItems: LocationListItem[] = useMemo(
    () =>
      Country.getAllCountries()
        .map((c) => ({ code: c.isoCode, name: c.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );
  const stateItems: LocationListItem[] = useMemo(
    () =>
      countryCode
        ? State.getStatesOfCountry(countryCode)
            .map((s) => ({ code: s.isoCode, name: s.name }))
            .sort((a, b) => a.name.localeCompare(b.name))
        : [],
    [countryCode],
  );
  // Coverage gap in the dataset: ~53 countries (mostly city-states/small
  // island nations) have no state-level data at all. Those fall back to a
  // plain text field for state instead of a dead-end picker with nothing in
  // it, and city then keys off the country directly.
  const hasStateOptions = countryCode !== "" && stateItems.length > 0;

  const cityItems: LocationListItem[] = useMemo(() => {
    if (countryCode && stateCode) {
      return City.getCitiesOfState(countryCode, stateCode)
        .map((c) => ({ code: c.name, name: c.name }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }
    if (countryCode && !hasStateOptions) {
      return (City.getCitiesOfCountry(countryCode) ?? [])
        .map((c) => ({ code: c.name, name: c.name }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }
    return [];
  }, [countryCode, stateCode, hasStateOptions]);
  // Also a real gap: ~31% of states in the dataset have zero cities listed.
  // Same fallback -- free text once that state is reachable, rather than a
  // required field with an empty picker and no way to satisfy it.
  const cityReachable = hasStateOptions ? stateCode !== "" : countryCode !== "";
  const hasCityOptions = cityReachable && cityItems.length > 0;

  function selectCountry(item: LocationListItem) {
    setCountryCode(item.code);
    setCountry(item.name);
    setStateCode("");
    setState("");
    setCity("");
    setPickerOpen(null);
  }

  function selectState(item: LocationListItem) {
    setStateCode(item.code);
    setState(item.name);
    setCity("");
    setPickerOpen(null);
  }

  function selectCity(item: LocationListItem) {
    setCity(item.name);
    setPickerOpen(null);
  }

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
          if (!country) {
            const matchedCountry = Country.getAllCountries().find(
              (c) => c.name === geocoded.country,
            );
            setCountry(geocoded.country);
            setCountryCode(matchedCountry?.isoCode ?? "");
            if (!state && matchedCountry) {
              const matchedState = State.getStatesOfCountry(matchedCountry.isoCode).find(
                (s) => s.name === geocoded.state,
              );
              setState(geocoded.state);
              setStateCode(matchedState?.isoCode ?? "");
            }
          }
          setCity((v) => v || geocoded.city);
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

  const valid =
    addressLine.trim().length > 0 &&
    city.trim().length > 0 &&
    state.trim().length > 0 &&
    country.trim().length > 0;

  async function handleSave() {
    if (!valid) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    try {
      await onSave({
        addressLine: addressLine.trim(),
        addressLine2: addressLine2.trim(),
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
              placeholder="Address line 1"
              className={`w-full text-base border rounded-xl px-4 py-3 outline-none focus:border-gray-400 transition-colors duration-150 ${
                showErrors && !addressLine.trim() ? "border-red-300" : "border-gray-200"
              }`}
            />
            <input
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
              placeholder="Address line 2 — apartment, suite, landmark (optional)"
              className="w-full text-base border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-gray-400 transition-colors duration-150"
            />

            <button
              type="button"
              onClick={() => setPickerOpen("country")}
              className={`w-full flex items-center justify-between text-base border rounded-xl px-4 py-3 transition-colors duration-150 ${
                showErrors && !country.trim() ? "border-red-300" : "border-gray-200"
              }`}
            >
              <span className={country ? "text-gray-900" : "text-gray-400"}>
                {country || "Country"}
              </span>
              <ChevronRight size={16} className="text-gray-300 shrink-0" />
            </button>

            {countryCode && !hasStateOptions ? (
              <input
                value={state}
                onChange={(e) => {
                  setState(e.target.value);
                  setCity("");
                }}
                placeholder="State"
                className={`w-full text-base border rounded-xl px-4 py-3 outline-none focus:border-gray-400 transition-colors duration-150 ${
                  showErrors && !state.trim() ? "border-red-300" : "border-gray-200"
                }`}
              />
            ) : (
              <button
                type="button"
                onClick={() => countryCode && setPickerOpen("state")}
                disabled={!countryCode}
                className={`w-full flex items-center justify-between text-base border rounded-xl px-4 py-3 transition-colors duration-150 disabled:opacity-50 ${
                  showErrors && !state.trim() ? "border-red-300" : "border-gray-200"
                }`}
              >
                <span className={state ? "text-gray-900" : "text-gray-400"}>
                  {state || "State"}
                </span>
                <ChevronRight size={16} className="text-gray-300 shrink-0" />
              </button>
            )}

            {cityReachable && !hasCityOptions ? (
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
                className={`w-full text-base border rounded-xl px-4 py-3 outline-none focus:border-gray-400 transition-colors duration-150 ${
                  showErrors && !city.trim() ? "border-red-300" : "border-gray-200"
                }`}
              />
            ) : (
              <button
                type="button"
                onClick={() => cityReachable && setPickerOpen("city")}
                disabled={!cityReachable}
                className={`w-full flex items-center justify-between text-base border rounded-xl px-4 py-3 transition-colors duration-150 disabled:opacity-50 ${
                  showErrors && !city.trim() ? "border-red-300" : "border-gray-200"
                }`}
              >
                <span className={city ? "text-gray-900" : "text-gray-400"}>{city || "City"}</span>
                <ChevronRight size={16} className="text-gray-300 shrink-0" />
              </button>
            )}
          </div>
          {showErrors && !valid && (
            <p className="text-xs text-red-500 mt-2">
              Address line 1, city, state, and country are required.
            </p>
          )}
        </div>

        {pickerOpen === "country" && (
          <LocationListPicker
            title="Country"
            items={countryItems}
            onSelect={selectCountry}
            onClose={() => setPickerOpen(null)}
          />
        )}
        {pickerOpen === "state" && (
          <LocationListPicker
            title="State"
            items={stateItems}
            onSelect={selectState}
            onClose={() => setPickerOpen(null)}
          />
        )}
        {pickerOpen === "city" && (
          <LocationListPicker
            title="City"
            items={cityItems}
            onSelect={selectCity}
            onClose={() => setPickerOpen(null)}
          />
        )}

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
