import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { readStoreDraft, type StoreDraft } from "@/lib/onboarding-state";
import { nextRoute, previousStep, stepPosition } from "@/lib/onboarding-flow";
import {
  FormError,
  OnboardingChecking,
  OnboardingShell,
} from "@/components/onboarding/OnboardingShell";
import { useRequireSession } from "@/components/onboarding/use-require-session";
import { usePrefetchNextStep } from "@/hooks/use-prefetch-next-step";

export const Route = createFileRoute("/name-your-store")({
  head: () => ({ meta: [{ title: "Name your store — Oakmonte" }] }),
  component: NameYourStorePage,
});

function slugify(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    // Decompose accents so "Chloé" becomes "chloe" rather than "chlo".
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "");

  if (!slug) {
    return `store-${Math.random().toString(36).slice(2, 8)}`;
  }

  return slug;
}

function NameYourStorePage() {
  const navigate = useNavigate();
  const { userId, checking } = useRequireSession();
  usePrefetchNextStep("seller", "/name-your-store");
  const [brandName, setBrandName] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Read after mount — reading storage during render made the heading and
  // placeholders differ between the server render and hydration.
  const [draft, setDraft] = useState<StoreDraft | null>(null);
  // Guards the profiles fallback fetch below to at most one attempt — without
  // it, a genuine "never answered seller-type" visitor (storeType stays null
  // even after the fetch resolves) would refetch on every render.
  const [pendingFetched, setPendingFetched] = useState(false);

  useEffect(() => {
    setDraft(readStoreDraft());
  }, []);

  // localStorage is empty exactly when /seller-type was answered on a
  // different device/browser, or localStorage was cleared in between (Safari
  // private browsing, etc.) — profiles.pending_store_type is the durable
  // fallback written there for exactly this case. See the
  // add_pending_seller_type_to_profiles migration.
  useEffect(() => {
    if (!userId || !draft || draft.storeType || pendingFetched) return;
    setPendingFetched(true);
    let cancelled = false;
    supabase
      .from("profiles")
      .select("pending_store_type, pending_offers_custom_orders")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data?.pending_store_type) return;
        setDraft({
          storeType: data.pending_store_type,
          customOrders: data.pending_offers_custom_orders,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [userId, draft, pendingFetched]);

  const isBrand = draft?.storeType === "Brand";
  const isArtist = draft?.storeType === "Artist";
  const noun = isBrand ? "brand" : isArtist ? "store/gallery" : "store";
  const handle = slugify(brandName);

  // replace, not push: Back into this form and re-submitting is how a seller
  // ends up with two stores, which has already happened to a live account.
  // The welcome screen clears the onboarding scratch state, not this step —
  // it still needs the local intent as a fallback if the profile read fails.
  const finish = () => {
    // The real answer now lives on the stores row just written — best-effort,
    // non-blocking cleanup of the scratch copy on profiles so it doesn't sit
    // around looking like unresolved data.
    if (userId) {
      supabase
        .from("profiles")
        .update({ pending_store_type: null, pending_offers_custom_orders: false })
        .eq("id", userId)
        .then(({ error: clearError }) => {
          if (clearError) {
            console.error("NameYourStorePage: failed to clear pending store type", clearError);
          }
        });
    }
    navigate({ to: nextRoute("seller", "/name-your-store"), replace: true });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!brandName.trim() || !userId) return;

    setLoading(true);
    setError(null);

    const typeFields = draft?.storeType
      ? { store_type: draft.storeType, offers_custom_orders: draft.customOrders }
      : {};

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("You're no longer signed in. Please sign in again.");
      setLoading(false);
      return;
    }

    // stores has no unique constraint on owner_id, so re-entering this step
    // (Back, refresh, a resumed flow) used to silently create a second store —
    // and every later `.eq("owner_id", …)` update then wrote to both.
    const { data: existingRows, error: lookupError } = await supabase
      .from("stores")
      .select("id")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1);

    if (lookupError) {
      setLoading(false);
      setError("Something went wrong. Please try again.");
      console.error(lookupError);
      return;
    }

    const existing = existingRows?.[0] ?? null;

    if (existing) {
      const { error: updateError } = await supabase
        .from("stores")
        .update({
          brand_name: brandName.trim(),
          store_username: handle,
          business_email: businessEmail.trim() || null,
          ...typeFields,
        })
        .eq("id", existing.id);

      setLoading(false);
      if (updateError) {
        setError(
          updateError.code === "23505"
            ? "That name is taken. Try another."
            : "Something went wrong. Please try again.",
        );
        if (updateError.code !== "23505") console.error(updateError);
        return;
      }
      finish();
      return;
    }

    const { error: insertError } = await supabase.from("stores").insert({
      owner_id: user.id,
      brand_name: brandName.trim(),
      store_username: handle,
      business_email: businessEmail.trim() || null,
      ...typeFields,
    });

    setLoading(false);

    if (insertError) {
      if (insertError.code === "23505") {
        setError("That name is taken. Try another.");
      } else {
        setError("Something went wrong. Please try again.");
        console.error(insertError);
      }
      return;
    }

    finish();
  };

  if (checking || !draft) return <OnboardingChecking />;

  return (
    <OnboardingShell
      title={isBrand ? "Name your brand" : isArtist ? "Name your Store/Gallery" : "Name your store"}
      subtitle={`Pick a name that reflects your ${noun}.`}
      backTo={previousStep("seller", "/name-your-store")}
      step={stepPosition("seller", "/name-your-store")}
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <label htmlFor="brand-name" className="sr-only">
          {isBrand ? "Brand name" : "Store name"}
        </label>
        <input
          id="brand-name"
          type="text"
          required
          autoFocus
          autoComplete="organization"
          value={brandName}
          onChange={(e) => setBrandName(e.target.value)}
          placeholder={isBrand ? "My Brand" : "My Store"}
          aria-describedby="handle-preview"
          className="w-full rounded-full border border-brand-text/25 bg-transparent px-5 py-3.5 text-sm placeholder:text-brand-text/40 focus:outline-none focus:border-brand-accent transition-colors"
        />
        {/* The handle used to be derived silently, so a name of only symbols
            became "store-x7k2p9" without the user ever seeing it. */}
        <p id="handle-preview" className="text-[11px] text-brand-text/50 px-2 text-left">
          Your {noun} link: oakmonte.com/{brandName.trim() ? handle : `your-${noun}`}
        </p>

        <label htmlFor="business-email" className="sr-only">
          {isBrand ? "Brand email" : "Store email"} (optional)
        </label>
        <input
          id="business-email"
          type="email"
          autoComplete="email"
          value={businessEmail}
          onChange={(e) => setBusinessEmail(e.target.value)}
          placeholder={`${isBrand ? "Brand" : "Store"} email (optional for now)`}
          className="w-full rounded-full border border-brand-text/25 bg-transparent px-5 py-3.5 text-sm placeholder:text-brand-text/40 focus:outline-none focus:border-brand-accent transition-colors"
        />
        <button
          type="submit"
          disabled={loading || !brandName.trim()}
          className="w-full rounded-full bg-brand-accent text-brand-bg py-3.5 text-sm font-medium uppercase tracking-widest hover:bg-brand-accent/90 hover:scale-[1.01] transition-all duration-300 disabled:opacity-40"
        >
          {loading ? "Saving…" : "Finish"}
        </button>
        <FormError>{error}</FormError>
      </form>
    </OnboardingShell>
  );
}
