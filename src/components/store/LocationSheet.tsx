import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { X, MapPin, LocateFixed, ChevronRight, Check } from "lucide-react";
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
// No country-state-city import here -- not even the deep /lib/country and
// /lib/state paths this used to use. This sheet sits behind the /store layout,
// so anything imported at module scope lands in every dashboard screen: those
// files broke dev SSR on all of /store/* (ESM JSON imports with no import
// attribute), shipped ~650 KB to every visit, and made each cold server render
// parse the package's 10 MB lib. Countries and states come from
// @/lib/region-data and cities from @/lib/city-data -- NG/US instantly, the rest
// loaded when this sheet mounts.
import {
  allStatesReady,
  countryCodeForName,
  getCountries,
  getStates,
  isSeededStateCountry,
  loadAllStates,
  subscribeToStates,
} from "@/lib/region-data";
import { useLockedViewport } from "@/hooks/use-locked-viewport";
import { LocationListPicker, type LocationListItem } from "./LocationListPicker";

export type StoreLocationValues = {
  id?: string;
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

// No paid geocoding provider is wired up yet (no Mapbox/Google Maps key in
// env) -- Nominatim's free reverse endpoint is a placeholder that's fine at
// this volume (one lookup per seller tap, not bulk/automated) but should
// move to a paid provider before this needs to hold up at scale. Street-level
// guesses (house number/road) are unreliable enough for informal Nigerian
// addressing that we don't even use them -- only city/state/country plus the
// exact lat/lng pin are trustworthy enough to autofill.
async function reverseGeocode(lat: number, lng: number) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
    { headers: { Accept: "application/json" } },
  );
  if (!res.ok) return null;
  const data = await res.json();
  const addr = data.address ?? {};
  return {
    city: addr.city || addr.town || addr.village || addr.county || "",
    state: addr.state || "",
    country: addr.country || "",
  };
}

/** Full-screen sheet for adding or editing one of the store's pickup/dispatch
 *  locations. Opens straight to the manual address form, and a beat later
 *  surfaces a "use current location" prompt on top of it -- accepting that
 *  just fills the same fields (still editable) and captures the exact
 *  lat/lng pin riders need, it never replaces manual entry. */
export function LocationSheet({
  initial,
  onSave,
  onDelete,
  onClose,
  affectedStockCount,
}: {
  initial: StoreLocationValues | null;
  onSave: (values: StoreLocationValues) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onClose: () => void;
  // How many product_variant_stock rows cascade-delete along with this
  // location -- undefined when the caller doesn't track this (this sheet
  // doubles as the product form's "Add pickup location" side-trip, which
  // never deletes), null while the caller is still counting.
  affectedStockCount?: number | null;
}) {
  useLockedViewport();
  const isEditing = !!initial?.id;

  const [name, setName] = useState(initial?.name ?? "");
  const [addressLine, setAddressLine] = useState(initial?.addressLine ?? "");
  const [addressLine2, setAddressLine2] = useState(initial?.addressLine2 ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [state, setState] = useState(initial?.state ?? "");
  const [country, setCountry] = useState(initial?.country ?? "");
  const [postalCode, setPostalCode] = useState(initial?.postalCode ?? "");
  const [lat, setLat] = useState<number | null>(initial?.lat ?? null);
  const [lng, setLng] = useState<number | null>(initial?.lng ?? null);

  // isoCodes drive the country -> state -> city cascade; the saved values
  // stay plain names (matches existing DB rows and avoids a schema change).
  // Seeded from the saved name on mount so editing an existing location
  // still shows the right cascade -- falls back to unmatched (no code) for
  // older free-text rows that don't line up with the dataset, which just
  // means re-picking that field replaces it.
  const [countryCode, setCountryCode] = useState<string>(() =>
    countryCodeForName(initial?.country),
  );
  // Only resolvable here for seeded countries (NG/US). For anything else the
  // states haven't loaded yet, so this starts empty and the effect further down
  // fills it in the moment they land.
  const [stateCode, setStateCode] = useState<string>(
    () => getStates(countryCode).find((s) => s.name === initial?.state)?.code ?? "",
  );

  const [pickerOpen, setPickerOpen] = useState<"country" | "state" | null>(null);
  const [promptVisible, setPromptVisible] = useState(false);
  const [locating, setLocating] = useState(false);
  const [located, setLocated] = useState(false);
  const [locateError, setLocateError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const countryItems: LocationListItem[] = useMemo(
    () => [...getCountries()].sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );
  // Re-renders once every country's states finish loading in.
  const statesReady = useSyncExternalStore(
    subscribeToStates,
    allStatesReady,
    () => false, // SSR: only the seed exists on the server
  );
  const stateItems: LocationListItem[] = useMemo(
    () => [...getStates(countryCode)].sort((a, b) => a.name.localeCompare(b.name)),
    // statesReady isn't read above; it's a dep so the list recomputes the
    // moment the full dataset lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [countryCode, statesReady],
  );
  const statesStillLoading = !statesReady && !!countryCode && !isSeededStateCountry(countryCode);

  // A state NAME can be known before its list is: editing a saved Ghanaian
  // location, or the GPS fill below, both set the name while that country's
  // states are still loading. Once they arrive, recover the code so the city
  // list narrows to that state again. Never overrides a code that is already
  // set, and a typed custom state simply won't match -- it stays free text.
  useEffect(() => {
    if (stateCode || !state || !countryCode) return;
    const match = getStates(countryCode).find((s) => s.name === state);
    if (match) setStateCode(match.code);
  }, [countryCode, state, stateCode, statesReady]);
  function selectCountry(item: LocationListItem) {
    setCountryCode(item.code);
    setCountry(item.name);
    setStateCode("");
    setState("");
    setCity("");
    setPickerOpen(null);
  }

  function selectState(item: LocationListItem) {
    // A typed custom value has no isoCode (it's not in the dataset), so the
    // city list falls back to the whole country's cities rather than a
    // specific state's -- still useful as suggestions, just not filtered.
    setStateCode(stateItems.some((s) => s.code === item.code) ? item.code : "");
    setState(item.name);
    setCity("");
    setPickerOpen(null);
  }

  useEffect(() => {
    const t = setTimeout(() => setPromptVisible(true), 350);
    return () => clearTimeout(t);
  }, []);

  // Start pulling the rest of the world's states the moment the sheet opens,
  // so it's usually there before anyone taps into the state picker.
  useEffect(() => {
    void loadAllStates();
  }, []);

  function useCurrentLocation() {
    if (!("geolocation" in navigator)) {
      setLocateError("Location isn't available on this device.");
      return;
    }
    setLocated(false);
    setLocating(true);
    setLocateError("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setLat(latitude);
        setLng(longitude);
        const geocoded = await reverseGeocode(latitude, longitude).catch(() => null);
        if (geocoded && !country) {
          const matchedCountryCode = countryCodeForName(geocoded.country);
          setCountry(geocoded.country);
          setCountryCode(matchedCountryCode);
          if (!state && matchedCountryCode) {
            // May be empty if this country's states are still loading; the
            // re-match effect above picks the code up when they land.
            const matchedState = getStates(matchedCountryCode).find(
              (s) => s.name === geocoded.state,
            );
            setState(geocoded.state);
            setStateCode(matchedState?.code ?? "");
          }
          if (!city) setCity(geocoded.city);
        }
        setLocating(false);
        setLocated(true);
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
    name.trim().length > 0 &&
    addressLine.trim().length > 0 &&
    city.trim().length > 0 &&
    state.trim().length > 0 &&
    country.trim().length > 0 &&
    postalCode.trim().length > 0;

  async function handleSave() {
    if (!valid) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    try {
      await onSave({
        id: initial?.id,
        name: name.trim(),
        addressLine: addressLine.trim(),
        addressLine2: addressLine2.trim(),
        city: city.trim(),
        state: state.trim(),
        country: country.trim(),
        postalCode: postalCode.trim(),
        lat,
        lng,
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!initial?.id || !onDelete) return;
    setConfirmDeleteOpen(false);
    setDeleting(true);
    try {
      await onDelete(initial.id);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-sd-surface flex flex-col min-h-dvh animate-in fade-in slide-in-from-bottom-6 duration-[var(--duration-slow)] ease-[var(--ease-smooth-out)]">
      <div className="bg-sd-surface/95 backdrop-blur border-b border-sd-line px-4 h-14 flex items-center justify-between shrink-0">
        <button onClick={onClose} type="button" className="p-1 -ml-1">
          <X size={20} className="text-sd-ink-muted" />
        </button>
        <span className="font-semibold text-[15px] absolute left-1/2 -translate-x-1/2">
          {isEditing ? "Edit location" : "New location"}
        </span>
        <span className="w-5" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-6">
        {promptVisible && (
          <div className="border border-sd-line rounded-3xl p-5 flex items-start gap-3.5 bg-sd-elevated animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="p-2 rounded-full bg-sd-surface border border-sd-line shrink-0">
              <LocateFixed size={16} className="text-sd-ink" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-sd-ink">Use my current location</p>
              <p className="text-xs text-sd-ink-muted mt-0.5">
                Fills in city, state and country, and saves the exact pin riders use to find you —
                you'll still enter the street address yourself.
              </p>
              {locateError && <p className="text-xs text-sd-danger-ink mt-1.5">{locateError}</p>}
              <div className="flex items-center gap-3 mt-3.5">
                <button
                  type="button"
                  onClick={useCurrentLocation}
                  disabled={locating}
                  className="flex items-center gap-1.5 text-[15px] font-medium text-sd-bg bg-sd-ink rounded-full px-6 py-3.5 oak-motion-control active:scale-[0.98] disabled:opacity-50"
                >
                  {locating ? (
                    "Locating…"
                  ) : located ? (
                    <>
                      <Check size={16} />
                      Location added
                    </>
                  ) : (
                    "Use current location"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        <div>
          <p className="text-[17px] font-semibold text-sd-ink mb-3">Address</p>
          <div className="flex flex-col gap-3">
            <input
              value={addressLine}
              onChange={(e) => setAddressLine(e.target.value)}
              placeholder="Address line 1"
              className={`w-full text-base border rounded-xl px-4 py-3 outline-none focus:border-sd-ink-faint transition-colors duration-150 ${
                showErrors && !addressLine.trim() ? "border-sd-danger-mark/50" : "border-sd-line"
              }`}
            />
            <input
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
              placeholder="Address line 2 — apartment, suite, landmark (optional)"
              className="w-full text-base border border-sd-line rounded-xl px-4 py-3 outline-none focus:border-sd-ink-faint transition-colors duration-150"
            />

            <button
              type="button"
              onClick={() => setPickerOpen("country")}
              className={`w-full flex items-center justify-between text-base border rounded-xl px-4 py-3 transition-colors duration-150 ${
                showErrors && !country.trim() ? "border-sd-danger-mark/50" : "border-sd-line"
              }`}
            >
              <span className={country ? "text-sd-ink" : "text-sd-ink-faint"}>
                {country || "Country"}
              </span>
              <ChevronRight size={16} className="text-sd-ink-faint shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => countryCode && setPickerOpen("state")}
              disabled={!countryCode}
              className={`w-full flex items-center justify-between text-base border rounded-xl px-4 py-3 transition-colors duration-150 disabled:opacity-50 ${
                showErrors && !state.trim() ? "border-sd-danger-mark/50" : "border-sd-line"
              }`}
            >
              <span className={state ? "text-sd-ink" : "text-sd-ink-faint"}>
                {state || "State/Province/Region"}
              </span>
              <ChevronRight size={16} className="text-sd-ink-faint shrink-0" />
            </button>

            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City"
              className={`w-full text-base border rounded-xl px-4 py-3 outline-none focus:border-sd-ink-faint transition-colors duration-150 ${
                showErrors && !city.trim() ? "border-sd-danger-mark/50" : "border-sd-line"
              }`}
            />

            <input
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              placeholder="ZIP/Postal code"
              className={`w-full text-base border rounded-xl px-4 py-3 outline-none focus:border-sd-ink-faint transition-colors duration-150 ${
                showErrors && !postalCode.trim() ? "border-sd-danger-mark/50" : "border-sd-line"
              }`}
            />
          </div>
          {showErrors && !valid && (
            <p className="text-xs text-sd-danger-ink mt-2">
              Location name, address line 1, city, state, country, and ZIP/postal code are required.
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
            title="State/Province/Region"
            items={stateItems}
            allowCustom
            loadingNote={
              statesStillLoading
                ? "Still loading regions for this country — you can type yours in."
                : undefined
            }
            onSelect={selectState}
            onClose={() => setPickerOpen(null)}
          />
        )}
        {lat != null && lng != null && (
          <div className="flex items-center gap-2 text-xs text-sd-ink-muted">
            <MapPin size={13} className="text-sd-ink-faint shrink-0" />
            Exact pin saved ({lat.toFixed(5)}, {lng.toFixed(5)}) — riders use this to find you.
          </div>
        )}

        <p className="text-xs text-sd-ink-muted flex items-start gap-1.5">
          <ChevronRight size={13} className="text-sd-ink-faint shrink-0 mt-0.5" />
          Only riders dispatching your orders (and you, at checkout as a buyer) see this. Curators
          and creators never do.
        </p>

        {isEditing && onDelete && (
          <button
            type="button"
            onClick={() => setConfirmDeleteOpen(true)}
            disabled={deleting}
            className="text-xs font-medium text-sd-danger-ink disabled:opacity-50 self-start"
          >
            {deleting ? "Deleting…" : "Delete this location"}
          </button>
        )}

        <div>
          <p className="text-[17px] font-semibold text-sd-ink mb-1">
            Location name <span className="text-xs font-normal text-sd-ink-faint">(required)</span>
          </p>
          <p className="text-xs text-sd-ink-muted mb-3">
            So you can tell it apart from your other locations — e.g. "Lekki warehouse" or "Main
            store".
          </p>
          <div className="relative">
            <input
              id="location-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder=" "
              className={`w-full text-base border rounded-xl px-4 py-3 outline-none focus:border-sd-ink-faint transition-colors duration-150 ${
                showErrors && !name.trim() ? "border-sd-danger-mark/50" : "border-sd-line"
              }`}
            />
            {!name.trim() && (
              <label
                htmlFor="location-name-input"
                className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1 text-sd-ink-faint pointer-events-none"
              >
                <span className="text-base">Custom location name</span>
                <span className="text-xs">e.g main store</span>
              </label>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 pt-3 oak-safe-bottom border-t border-sd-line bg-sd-surface shrink-0">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-sd-ink text-sd-bg text-sm font-medium rounded-full py-3.5 disabled:opacity-50"
        >
          {saving ? "Saving…" : isEditing ? "Save changes" : "Add location"}
        </button>
      </div>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent className="max-w-[92vw] rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this location?</AlertDialogTitle>
            <AlertDialogDescription>
              {affectedStockCount
                ? `Stock counts for ${affectedStockCount} variant${affectedStockCount === 1 ? "" : "s"} at this location will be removed. Products themselves are kept. This can't be undone.`
                : affectedStockCount === null
                  ? // Still counting, or the count request itself failed silently
                    // (see LocationsListSheet) -- either way, a location that turns
                    // out to hold real stock shouldn't be understated as riskless
                    // just because this number never arrived.
                    "Any stock counts saved at this location will be removed too. This can't be undone."
                  : "This can't be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-sd-ink text-sd-bg rounded-full">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
