import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { AddressAutocomplete, type PickedAddress } from "@/components/AddressAutocomplete";
import { ChevronRight, LocateFixed } from "lucide-react";
import {
  allStatesReady,
  countryCodeForName,
  getCountries,
  getStates,
  loadAllStates,
  subscribeToStates,
} from "@/lib/region-data";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { authedFetch } from "@/lib/authed-fetch";
import { ListPicker } from "./ListPicker";

/** What is being bought, in the shape /api/shipping/rates and /api/orders read
 *  (see parseOrderLines): one product from Buy Now, or one store's bag lines.
 *  Ids and counts only; the server prices everything. */
export type CheckoutLines =
  | { productId: string; variantId?: string }
  | { items: { productId: string; variantId: string; quantity: number }[] };

type Courier = {
  courierId: string;
  serviceCode: string;
  name: string;
  price: number;
  eta: string | null;
};

type Validated = {
  addressCode: number;
  formattedAddress: string;
  lat: number | null;
  lng: number | null;
};

// A quick, coarse fix first (network/cached position answers in about a
// second), the way maps apps do it. enableHighAccuracy waits for a GPS lock,
// which is what makes "use my location" crawl on Android. A street address
// only needs the coarse fix; Shipbubble validates the text anyway.
function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      maximumAge: 10 * 60 * 1000,
      timeout: 8000,
    });
  });
}

// "12" or "Lekki" alone isn't an address a rider can use: it needs at least two
// spaced words, one with letters. A house number is common but not universal,
// so a missing one only nudges (see the hint under the field).
function addressLineOk(v: string) {
  const words = v.trim().split(/\s+/).filter(Boolean);
  return words.length >= 2 && /[a-zA-Z]/.test(v);
}

/** The delivery half of checkout, shared by Buy Now (/checkout/$productId) and
 *  the bag (/checkout/cart): who and where (guest-friendly, validated through
 *  Shipbubble), live courier prices for that address, the totals, and placing
 *  the order. The page above it owns the summary of what's being bought. */
export function DeliveryCheckout({
  lines,
  subtotal,
  subtotalLabel,
  blockedReason,
  onOrderCreated,
}: {
  lines: CheckoutLines;
  /** Naira, the page's own reading of the items. Null hides the totals (the
   *  summary hasn't loaded). Replaced by the server's figure once rates come
   *  back, since that is the one the order is charged. */
  subtotal: number | null;
  subtotalLabel: string;
  /** Why the order can't be placed right now, shown under the button. */
  blockedReason?: string | null;
  /** The order exists; called just before leaving for payment. */
  onOrderCreated?: () => void;
}) {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [country, setCountry] = useState("Nigeria");
  const [countryCode, setCountryCode] = useState(() => countryCodeForName("Nigeria"));
  const [stateName, setStateName] = useState("");
  const [, setStateCode] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [pickerOpen, setPickerOpen] = useState<"country" | "state" | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [validated, setValidated] = useState<Validated | null>(null);
  const [couriers, setCouriers] = useState<Courier[] | null>(null);
  const [ratesError, setRatesError] = useState("");
  const [requestToken, setRequestToken] = useState<string | null>(null);
  const [serverItemsKobo, setServerItemsKobo] = useState<number | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState("");

  // Effects compare by value, not identity: callers build `lines` inline.
  const linesKey = JSON.stringify(lines);

  useEffect(() => {
    void loadAllStates();
  }, []);
  const statesReady = useSyncExternalStore(subscribeToStates, allStatesReady, () => false);
  const countryItems = useMemo(
    () => [...getCountries()].sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );
  const stateItems = useMemo(
    () => [...getStates(countryCode)].sort((a, b) => a.name.localeCompare(b.name)),
    // statesReady is a dep so the list refreshes when the full dataset lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [countryCode, statesReady],
  );

  useEffect(() => {
    void supabase.auth
      .getSession()
      .then(({ data }) => setUserEmail(data.session?.user.email ?? null));
  }, []);

  // Back from Paystack's page can restore this one from the back/forward
  // cache, frozen mid-"Placing order". Let the buyer try again.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) setPlacing(false);
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  // A picked suggestion fills the whole address; the buyer can still edit it.
  function applyPicked(a: PickedAddress) {
    if (a.country) {
      const code = countryCodeForName(a.country);
      setCountry(a.country);
      setCountryCode(code);
      const match = a.state ? getStates(code).find((s) => s.name === a.state) : undefined;
      setStateName(a.state);
      setStateCode(match?.code ?? "");
    }
    setAddressLine(a.line1);
    if (a.city) setCity(a.city);
    if (a.postalCode) setPostalCode(a.postalCode);
    if (a.lat != null && a.lng != null) setCoords({ lat: a.lat, lng: a.lng });
  }

  async function locateMe() {
    if (!("geolocation" in navigator)) {
      setError("Location isn't available on this device. Type your address instead.");
      return;
    }
    setError("");
    setLocating(true);
    try {
      const pos = await getPosition();
      const { latitude: lat, longitude: lng } = pos.coords;
      setCoords({ lat, lng });
      const res = await authedFetch("/api/shipping/reverse-geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng }),
      });
      const body = (await res.json().catch(() => null)) as {
        line1?: string | null;
        city?: string | null;
        state?: string | null;
        country?: string | null;
        postalCode?: string | null;
      } | null;
      if (!body || (!body.line1 && !body.city && !body.state)) {
        setError("Got your location but no street name. Fill in your address below.");
      } else {
        if (body.country) {
          const code = countryCodeForName(body.country);
          setCountry(body.country);
          setCountryCode(code);
          const match = body.state ? getStates(code).find((s) => s.name === body.state) : undefined;
          setStateName(body.state ?? "");
          setStateCode(match?.code ?? "");
        }
        if (body.line1) setAddressLine(body.line1);
        if (body.city) setCity(body.city);
        if (body.postalCode) setPostalCode(body.postalCode);
        if (!body.line1) setError("Check the details below and add your street and house number.");
      }
    } catch (e) {
      const denied = (e as GeolocationPositionError)?.code === 1;
      setError(
        denied
          ? "Location access was denied. Type your address instead."
          : "Couldn't get your location. Type your address instead.",
      );
    } finally {
      setLocating(false);
    }
  }

  async function confirmAddress() {
    setError("");
    setShowErrors(true);
    if (
      name.trim().split(/\s+/).filter(Boolean).length < 2 ||
      phoneDigits.length < 10 ||
      phoneDigits.length > 15 ||
      !addressLineOk(addressLine) ||
      !country.trim() ||
      !stateName.trim() ||
      !city.trim() ||
      !postalCode.trim() ||
      (!userEmail && email.trim() !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    ) {
      setError("Fix the highlighted fields.");
      return;
    }
    setChecking(true);
    try {
      const res = await authedFetch("/api/shipping/address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          address: fullAddress,
          looseAddress: [addressLine, city, stateName, country]
            .map((x) => x.trim())
            .filter(Boolean)
            .join(", "),
          lat: coords?.lat,
          lng: coords?.lng,
        }),
      });
      const body = (await res.json().catch(() => null)) as (Validated & { error?: string }) | null;
      if (!res.ok || !body?.addressCode) {
        setError(body?.error ?? "We couldn't check that address. Try again.");
        return;
      }
      setValidated(body);
    } finally {
      setChecking(false);
    }
  }

  // Prices come back for the validated address; re-run if it, or what's being
  // bought, changes.
  useEffect(() => {
    if (!validated) {
      setCouriers(null);
      setChosen(null);
      return;
    }
    let cancelled = false;
    setCouriers(null);
    setRatesError("");
    setServerItemsKobo(null);
    void (async () => {
      try {
        const res = await fetch("/api/shipping/rates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(JSON.parse(linesKey) as CheckoutLines),
            addressCode: validated.addressCode,
          }),
        });
        const body = (await res.json().catch(() => null)) as {
          couriers?: Courier[];
          requestToken?: string;
          itemsTotalKobo?: number;
          error?: string;
        } | null;
        if (cancelled) return;
        if (!res.ok || !body?.couriers) {
          setRatesError(body?.error ?? "Couldn't get delivery prices.");
          return;
        }
        setCouriers(body.couriers);
        setRequestToken(body.requestToken ?? null);
        setServerItemsKobo(typeof body.itemsTotalKobo === "number" ? body.itemsTotalKobo : null);
        const cheapest = [...body.couriers].sort((a, b) => a.price - b.price)[0];
        setChosen(cheapest ? cheapest.serviceCode : null);
      } catch {
        if (!cancelled) setRatesError("Couldn't get delivery prices.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [validated, linesKey]);

  const phoneDigits = phone.replace(/\D/g, "");
  const fullAddress = [addressLine, addressLine2, city, stateName, postalCode, country]
    .map((p) => p.trim())
    .filter(Boolean)
    .join(", ");
  const bad = (cond: boolean) => (showErrors && cond ? "!border-red-400/70" : "");
  async function placeOrder() {
    if (!validated || !pick || blockedReason) return;
    setPlaceError("");
    setPlacing(true);
    // Stays "placing" once the order exists: the page is on its way out, and a
    // second tap in that gap would create a second order.
    let leaving = false;
    try {
      const res = await authedFetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...lines,
          serviceCode: pick.serviceCode,
          addressCode: validated.addressCode,
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          address: validated.formattedAddress || fullAddress,
          lat: validated.lat,
          lng: validated.lng,
        }),
      });
      const body = (await res.json().catch(() => null)) as {
        orderUrl?: string;
        authorizationUrl?: string | null;
        error?: string;
      } | null;
      if (!res.ok || !body?.orderUrl) {
        setPlaceError(body?.error ?? "Couldn't place your order. Try again.");
        return;
      }
      leaving = true;
      onOrderCreated?.();
      // Paystack's hosted page takes the payment and returns to the order page;
      // with no keys configured yet the order page itself is the next stop.
      window.location.assign(body.authorizationUrl ?? body.orderUrl);
    } finally {
      if (!leaving) setPlacing(false);
    }
  }

  const pick = couriers?.find((c) => c.serviceCode === chosen) ?? null;
  const itemsTotal =
    subtotal == null ? null : serverItemsKobo != null ? serverItemsKobo / 100 : subtotal;

  const field =
    "w-full rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-3.5 text-[16px] text-white outline-none placeholder:text-white/35 focus:border-white/40";

  return (
    <>
      {!validated && (
        <div className="mt-6 flex flex-col gap-3">
          <h2 className="text-[20px] font-semibold">Where should we deliver?</h2>
          <input
            className={`${field} ${bad(name.trim().split(/\s+/).filter(Boolean).length < 2)}`}
            placeholder="Your bank account name (first and last)"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {!userEmail && (
            <input
              className={`${field} ${bad(email.trim() !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))}`}
              placeholder="Email (optional, for order updates)"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
          <input
            className={`${field} ${bad(phoneDigits.length < 10 || phoneDigits.length > 15)}`}
            placeholder="Phone number"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^0-9+\s-]/g, ""))}
          />
          {showErrors && (phoneDigits.length < 10 || phoneDigits.length > 15) && (
            <p className="-mt-1 text-[13px] text-red-400">
              Enter a valid phone number (digits only).
            </p>
          )}
          <div className="my-7 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/30" />
            <span className="text-[13px] font-semibold uppercase tracking-[0.14em] text-white/70">
              Address
            </span>
            <div className="h-px flex-1 bg-white/30" />
          </div>
          <button
            type="button"
            onClick={() => void locateMe()}
            disabled={locating}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/20 text-[15px] disabled:opacity-60"
          >
            <LocateFixed size={18} />
            {locating ? "Finding you…" : "Use my current location"}
          </button>
          <AddressAutocomplete
            className={`${field} w-full ${bad(!addressLineOk(addressLine))}`}
            placeholder="Start typing your address"
            value={addressLine}
            onChange={setAddressLine}
            onPick={applyPicked}
            regionCode={countryCode || undefined}
          />
          {showErrors && !addressLineOk(addressLine) && (
            <p className="-mt-1 text-[13px] text-red-400">
              Enter your street address, like &ldquo;12 Allen Avenue&rdquo;: house number and street
              name, separated by spaces.
            </p>
          )}
          {addressLineOk(addressLine) && !/\d/.test(addressLine) && (
            <p className="-mt-1 text-[13px] text-white/50">
              No house number? That&apos;s fine if your address doesn&apos;t have one.
            </p>
          )}
          <input
            className={field}
            placeholder="Address line 2: apartment, landmark (optional)"
            autoComplete="address-line2"
            value={addressLine2}
            onChange={(e) => setAddressLine2(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setPickerOpen("country")}
            className={`${field} flex items-center justify-between text-left ${bad(!country.trim())}`}
          >
            <span className={country ? "" : "text-white/35"}>{country || "Country"}</span>
            <ChevronRight size={16} className="text-white/40" />
          </button>
          <button
            type="button"
            onClick={() => countryCode && setPickerOpen("state")}
            disabled={!countryCode}
            className={`${field} flex items-center justify-between text-left disabled:opacity-50 ${bad(!stateName.trim())}`}
          >
            <span className={stateName ? "" : "text-white/35"}>
              {stateName || "State/Province/Region"}
            </span>
            <ChevronRight size={16} className="text-white/40" />
          </button>
          <input
            className={`${field} ${bad(!city.trim())}`}
            placeholder="City"
            autoComplete="address-level2"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
          <input
            className={`${field} ${bad(!postalCode.trim())}`}
            placeholder="ZIP/Postal code"
            autoComplete="postal-code"
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
          />
          {pickerOpen === "country" && (
            <ListPicker
              title="Country"
              items={countryItems}
              onSelect={(item) => {
                setCountry(item.name);
                setCountryCode(item.code);
                setStateName("");
                setStateCode("");
                setPickerOpen(null);
              }}
              onClose={() => setPickerOpen(null)}
            />
          )}
          {pickerOpen === "state" && (
            <ListPicker
              title="State/Province/Region"
              items={stateItems}
              allowCustom
              onSelect={(item) => {
                setStateName(item.name);
                setStateCode(item.code);
                setPickerOpen(null);
              }}
              onClose={() => setPickerOpen(null)}
            />
          )}
          {error && <p className="text-[14px] text-red-400">{error}</p>}
          <button
            type="button"
            onClick={() => void confirmAddress()}
            disabled={checking}
            className="mt-1 h-14 rounded-2xl bg-white text-[17px] font-semibold text-black disabled:opacity-60"
          >
            {checking ? "Checking address…" : "Continue"}
          </button>
        </div>
      )}

      {validated && (
        <div className="mt-6 flex flex-col gap-3">
          <h2 className="text-[20px] font-semibold">Delivering to</h2>
          <div className="rounded-2xl bg-white/[0.06] p-4 text-[15px]">
            <p className="font-medium">{name}</p>
            <p className="text-white/60">{phone}</p>
            <p className="mt-2 text-white/80">{validated.formattedAddress}</p>
          </div>
          <button
            type="button"
            onClick={() => setValidated(null)}
            className="h-12 rounded-2xl border border-white/20 text-[15px]"
          >
            Change address
          </button>
          <h2 className="mt-3 text-[20px] font-semibold">Delivery</h2>
          {couriers === null && !ratesError && (
            <p className="text-[14px] text-white/55">Getting live delivery prices…</p>
          )}
          {ratesError && <p className="text-[14px] text-red-400">{ratesError}</p>}
          {couriers && (
            <div className="flex flex-col gap-2">
              {[...couriers]
                .sort((a, b) => a.price - b.price)
                .map((c) => (
                  <button
                    key={c.serviceCode}
                    type="button"
                    onClick={() => setChosen(c.serviceCode)}
                    className={`flex items-center justify-between rounded-2xl border px-4 py-3.5 text-left ${
                      chosen === c.serviceCode
                        ? "border-white bg-white/10"
                        : "border-white/15 bg-white/[0.04]"
                    }`}
                  >
                    <span>
                      <span className="block text-[15px] font-medium">{c.name}</span>
                      {c.eta && <span className="block text-[13px] text-white/55">{c.eta}</span>}
                    </span>
                    <span className="text-[15px]">₦{c.price.toLocaleString()}</span>
                  </button>
                ))}
            </div>
          )}
          {pick && itemsTotal != null && (
            <div className="mt-1 flex flex-col gap-1 rounded-2xl bg-white/[0.06] p-4 text-[15px]">
              <div className="flex justify-between text-white/70">
                <span>{subtotalLabel}</span>
                <span>₦{itemsTotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-white/70">
                <span>Delivery ({pick.name})</span>
                <span>₦{pick.price.toLocaleString()}</span>
              </div>
              <div className="mt-1 flex justify-between border-t border-white/10 pt-2 font-semibold">
                <span>Total</span>
                <span>₦{(itemsTotal + pick.price).toLocaleString()}</span>
              </div>
            </div>
          )}
          <button
            type="button"
            disabled={!pick || !requestToken || placing || !!blockedReason}
            onClick={() => void placeOrder()}
            className="mt-1 h-14 rounded-2xl bg-white text-[17px] font-semibold text-black disabled:opacity-40"
          >
            {placing ? "Placing order…" : "Place order and pay"}
          </button>
          {blockedReason && <p className="text-[14px] text-white/60">{blockedReason}</p>}
          {placeError && <p className="text-[14px] text-red-400">{placeError}</p>}
        </div>
      )}
    </>
  );
}
