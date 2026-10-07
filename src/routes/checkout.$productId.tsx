import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, LocateFixed } from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { authedFetch } from "@/lib/authed-fetch";

export const Route = createFileRoute("/checkout/$productId")({
  validateSearch: (s: Record<string, unknown>): { variant?: string } => ({
    variant: typeof s.variant === "string" && s.variant ? s.variant : undefined,
  }),
  head: () => ({ meta: [{ title: "Checkout — Oakmonte" }] }),
  component: CheckoutPage,
});

type Summary = {
  title: string;
  variantLabel: string | null;
  price: number | null;
  image: string | null;
};

type Validated = {
  addressCode: number;
  formattedAddress: string;
  lat: number | null;
  lng: number | null;
};

async function loadSummary(productId: string, variantId?: string): Promise<Summary | null> {
  const { data } = await supabase
    .from("products")
    .select("title, product_variants(id, price, option1_value, main_image_url)")
    .eq("id", productId)
    .eq("status", "active")
    .maybeSingle();
  if (!data) return null;
  const variants = data.product_variants ?? [];
  const v = variants.find((x) => x.id === variantId) ?? variants[0];
  return {
    title: data.title ?? "Untitled",
    variantLabel: variants.length > 1 ? (v?.option1_value ?? null) : null,
    price: v?.price ?? null,
    image: v?.main_image_url ?? null,
  };
}

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

function CheckoutPage() {
  const { productId } = Route.useParams();
  const { variant } = Route.useSearch();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<Summary | null | undefined>(undefined);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [validated, setValidated] = useState<Validated | null>(null);

  useEffect(() => {
    void loadSummary(productId, variant).then(setSummary);
    void supabase.auth
      .getSession()
      .then(({ data }) => setUserEmail(data.session?.user.email ?? null));
  }, [productId, variant]);

  function back() {
    if (window.history.length > 1) window.history.back();
    else void navigate({ to: "/home" });
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
      const body = (await res.json().catch(() => null)) as { address?: string | null } | null;
      if (body?.address) setAddress(body.address);
      else setError("Got your location but no street name. Add your house number and street.");
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
    if (
      !name.trim() ||
      !phone.trim() ||
      address.trim().length < 8 ||
      (!userEmail && !email.trim())
    ) {
      setError("Add your account name, phone number and full address.");
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
          address: address.trim(),
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

  const field =
    "w-full rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-3.5 text-[16px] text-white outline-none placeholder:text-white/35 focus:border-white/40";

  return (
    <div
      className="min-h-screen bg-black pb-[calc(env(safe-area-inset-bottom)+2rem)] text-white"
      style={{ fontFamily: "'SF Pro', system-ui, sans-serif" }}
    >
      <header className="flex items-center gap-2 px-3 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
        <button
          type="button"
          onClick={back}
          aria-label="Back"
          className="grid h-10 w-10 place-items-center rounded-full bg-white/10"
        >
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-[17px] font-semibold">Checkout</h1>
      </header>

      <div className="mx-auto max-w-[520px] px-4 pt-5">
        {summary === null && <p className="text-white/60">This product isn&apos;t available.</p>}
        {summary && (
          <div className="flex items-center gap-3 rounded-2xl bg-white/[0.06] p-3">
            {summary.image && (
              <img src={summary.image} alt="" className="h-16 w-16 rounded-xl object-cover" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-medium">{summary.title}</p>
              {summary.variantLabel && (
                <p className="text-[13px] text-white/55">{summary.variantLabel}</p>
              )}
            </div>
            {summary.price != null && (
              <p className="text-[15px]">₦{summary.price.toLocaleString()}</p>
            )}
          </div>
        )}

        {!validated && (
          <div className="mt-6 flex flex-col gap-3">
            <h2 className="text-[20px] font-semibold">Where should we deliver?</h2>
            <input
              className={field}
              placeholder="Your bank account name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {!userEmail && (
              <input
                className={field}
                placeholder="Email (for order updates)"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
            <input
              className={field}
              placeholder="Phone number"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <textarea
              className={`${field} min-h-[96px] resize-none`}
              placeholder="Delivery address: house number, street, area, city"
              autoComplete="street-address"
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                setCoords(null);
              }}
            />
            <button
              type="button"
              onClick={() => void locateMe()}
              disabled={locating}
              className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/20 text-[15px] disabled:opacity-60"
            >
              <LocateFixed size={18} />
              {locating ? "Finding you…" : "Use my current location"}
            </button>
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
            <p className="text-[13px] text-white/50">
              Next: delivery options and payment (building now).
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
