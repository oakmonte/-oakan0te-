import { useEffect, useState } from "react";
import { authedFetch } from "@/lib/authed-fetch";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { hasInstalledApp } from "@/lib/installed-app";
import { useSession } from "@/hooks/use-session";

export type StoreSetupStatus = {
  // True until every signal below has resolved at least once -- callers that
  // gate a one-time action (like the profile page's seller prompt) on
  // `complete` need this so "still loading" is never mistaken for "done".
  loading: boolean;
  payoutSet: boolean;
  locationCount: number | null;
  productCount: number | null;
  themeIdSet: boolean;
  // Whether this account has opened the installed app. The checklist shows a
  // step for it, but see `complete` below -- it is deliberately not one of the
  // signals that add up to a finished store.
  installedApp: boolean;
  // Mirrors the four *store* steps store.index.tsx's checklist tracks (get
  // paid, pickup locations, list products, customise storefront) -- kept as one
  // shared hook so a "finished onboarding" check elsewhere in the app (e.g.
  // the profile page's seller prompt) can't quietly drift from what the
  // checklist itself considers done.
  //
  // `installedApp` is excluded on purpose, even though the checklist renders it
  // as a fifth card. It answers "does this person have the app", not "can this
  // store sell", and the checklist hides that card on desktop entirely -- so
  // counting it would leave every laptop seller permanently incomplete and
  // re-nagged by the profile prompt every single session, with no card on
  // screen to explain why.
  complete: boolean;
  // The first of the four store steps still outstanding, or null once they are
  // all done. Lives here rather than in the caller so the profile page's
  // prompt names the same "next thing" the checklist would put them on.
  // Mirrors store.index.tsx's card order -- keep the two in step.
  //
  // Scoped to the four `complete` signals for the same reason `complete` is:
  // "Get the webapp" does not exist on desktop, and a prompt that names a step
  // the seller cannot see is worse than one that names the step after it.
  nextStepLabel: string | null;
  // Escape hatch for a caller that just changed this itself (e.g. the
  // pickup-locations sheet reporting its own list length) and wants to
  // reflect that immediately rather than wait on a refetch.
  setLocationCount: (count: number) => void;
};

/** Fetches the same four onboarding signals store.index.tsx's checklist is
 *  built from. `storeId` null means "no store yet" -- loading stays true and
 *  complete stays false, since there's nothing to check. */
export function useStoreSetupStatus(storeId: string | null): StoreSetupStatus {
  const { user, loading: sessionLoading } = useSession();
  const [payoutSet, setPayoutSet] = useState(false);
  const [payoutLoaded, setPayoutLoaded] = useState(false);
  const [locationCount, setLocationCount] = useState<number | null>(null);
  const [productCount, setProductCount] = useState<number | null>(null);
  const [themeIdSet, setThemeIdSet] = useState(false);
  const [themeLoaded, setThemeLoaded] = useState(false);

  useEffect(() => {
    // Guarded on storeId like the other three, so a caller that passes null to
    // mean "not my store, don't look" isn't still charged an authed round trip.
    if (!storeId) return;
    let cancelled = false;
    authedFetch("/api/store/payout")
      .then((res) => res.json())
      .then((body) => {
        if (cancelled) return;
        setPayoutSet(!!body.account);
        setPayoutLoaded(true);
      })
      // An unknown payout state has to resolve to "not set", never to "still
      // loading". Without this a single dropped request pins `loading` true
      // for the rest of the session -- which silently disables the profile
      // prompt, makes nextStepLabel permanently null, and would strand
      // outright any future caller that disables a button on `loading`. There
      // is no retry path here. Same failure shape as the /passkey strand.
      .catch((err) => {
        if (cancelled) return;
        console.error("useStoreSetupStatus: failed to load payout status", err);
        setPayoutLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    supabase
      .from("store_locations")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .then(({ count, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("useStoreSetupStatus: failed to load pickup location count", error);
          return;
        }
        setLocationCount(count ?? 0);
      });
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .then(({ count, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("useStoreSetupStatus: failed to load product count", error);
          return;
        }
        setProductCount(count ?? 0);
      });
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    supabase
      .from("stores")
      .select("theme_id")
      .eq("id", storeId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("useStoreSetupStatus: failed to load theme status", error);
          return;
        }
        setThemeIdSet(!!data?.theme_id);
        setThemeLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  // `sessionLoading` is in here because `installedApp` reads the session user,
  // and `hasInstalledApp(null)` is indistinguishable from a real "no". Without
  // it, a cold load briefly reports an already-installed seller as not
  // installed -- long enough for store.index.tsx to tell them to go and install
  // an app they are already holding.
  const loading =
    !storeId ||
    sessionLoading ||
    !payoutLoaded ||
    locationCount === null ||
    productCount === null ||
    !themeLoaded;

  const nextStepLabel = loading
    ? null
    : !payoutSet
      ? "Get paid"
      : !locationCount
        ? "Add a pickup location"
        : !productCount
          ? "List your first product"
          : !themeIdSet
            ? "Customise your store front"
            : null;

  return {
    loading,
    payoutSet,
    locationCount,
    productCount,
    themeIdSet,
    installedApp: hasInstalledApp(user),
    complete: !loading && payoutSet && !!locationCount && !!productCount && themeIdSet,
    nextStepLabel,
    setLocationCount,
  };
}
