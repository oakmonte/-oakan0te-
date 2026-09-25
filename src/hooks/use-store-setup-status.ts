import { useCallback, useEffect, useState } from "react";
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
  // The payout account's verification state, straight from /api/store/payout,
  // or null when there is no account (or the request failed).
  //
  // Deliberately separate from `payoutSet`, because the two answer different
  // questions and conflating them breaks the app in opposite directions.
  // `payoutSet` is "can this store be paid out to" -- it gates the checklist's
  // order and `complete` below. `payoutStatus` is "has anyone checked the
  // details yet", and is only ever used to colour a status mark.
  //
  // Nothing in the app currently writes anything but "pending":
  // api.store.payout.ts hardcodes it on insert and Paystack is not connected.
  // So this stays "pending" indefinitely, which is the truth, not a bug. Gate
  // anything structural on it -- `complete`, or a step's `done` -- and no
  // seller ever finishes setup.
  payoutStatus: string | null;
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
  // Null until the store's first-ever completion is stamped (see the effect
  // below). store.index.tsx forks on `complete || onboardedAt` so graduating
  // to the dashboard is one-way -- see stores.onboarded_at's migration
  // comment for why `complete` alone flips both ways.
  onboardedAt: string | null;
  // True when any of the signals could not be loaded. `loading` stays true in
  // that case -- the answer is genuinely unknown -- so a caller gating a
  // one-off action on `!loading && !complete` (the profile page's "your store
  // isn't live" prompt) does not fire it at a seller who is in fact finished.
  // A caller that renders the store itself should check this first and offer
  // `retry`, because otherwise it sits on a skeleton indefinitely.
  failed: boolean;
  // Re-fetches every signal. Clears `failed` immediately.
  retry: () => void;
};

/** Fetches the same four onboarding signals store.index.tsx's checklist is
 *  built from. `storeId` null means "no store yet" -- loading stays true and
 *  complete stays false, since there's nothing to check. */
export function useStoreSetupStatus(storeId: string | null): StoreSetupStatus {
  const { user, loading: sessionLoading } = useSession();
  const [payoutSet, setPayoutSet] = useState(false);
  const [payoutStatus, setPayoutStatus] = useState<string | null>(null);
  const [payoutLoaded, setPayoutLoaded] = useState(false);
  const [locationCount, setLocationCount] = useState<number | null>(null);
  const [productCount, setProductCount] = useState<number | null>(null);
  const [themeIdSet, setThemeIdSet] = useState(false);
  const [themeLoaded, setThemeLoaded] = useState(false);
  const [onboardedAt, setOnboardedAt] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  // Bumped by retry(); every fetch below depends on it.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // Guarded on storeId like the other three, so a caller that passes null to
    // mean "not my store, don't look" isn't still charged an authed round trip.
    if (!storeId) return;
    let cancelled = false;
    authedFetch("/api/store/payout")
      .then((res) => {
        // A 401 or 500 carries a JSON body with no `account` in it, which read
        // straight through as "no payout account" -- dropping a finished
        // seller back to the setup checklist because of a server hiccup. The
        // handler returns 200 with account:null for a store that genuinely
        // has none, so a non-2xx here is always a failure, never an answer.
        if (!res.ok) throw new Error(`payout status request failed (${res.status})`);
        return res.json();
      })
      .then((body) => {
        if (cancelled) return;
        setPayoutSet(!!body.account);
        // The API has always returned this; the hook used to drop it on the
        // floor, which is why every completed checklist step rendered the same
        // amber dot and "done" was indistinguishable from "pending".
        setPayoutStatus(body.account?.status ?? null);
        setPayoutLoaded(true);
      })
      // An unknown payout state used to resolve to "not set", because there
      // was no retry path and a stuck `loading` stranded callers (the same
      // shape as the /passkey strand). But "not set" is a false answer: it
      // made `complete` false, so one dropped request sent a finished seller
      // back into the onboarding checklist. It now reports `failed`, which
      // the store home turns into a retry, and `loading` stays true so the
      // profile prompt cannot fire on a guess.
      .catch((err) => {
        if (cancelled) return;
        console.error("useStoreSetupStatus: failed to load payout status", err);
        setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [storeId, attempt]);

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
          setFailed(true);
          return;
        }
        setLocationCount(count ?? 0);
      });
    return () => {
      cancelled = true;
    };
  }, [storeId, attempt]);

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
          setFailed(true);
          return;
        }
        setProductCount(count ?? 0);
      });
    return () => {
      cancelled = true;
    };
  }, [storeId, attempt]);

  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    supabase
      .from("stores")
      .select("theme_id, onboarded_at")
      .eq("id", storeId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("useStoreSetupStatus: failed to load theme status", error);
          setFailed(true);
          return;
        }
        setThemeIdSet(!!data?.theme_id);
        setOnboardedAt(data?.onboarded_at ?? null);
        setThemeLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [storeId, attempt]);

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

  const retry = useCallback(() => {
    setFailed(false);
    setAttempt((a) => a + 1);
  }, []);

  const complete = !loading && payoutSet && !!locationCount && !!productCount && themeIdSet;

  // Stamps the one-way graduation the instant this store first finishes
  // setup. Gated on `themeLoaded` (not just `complete`) so this never fires
  // from a stale pre-fetch render, and on `!onboardedAt` so it only ever
  // writes once per store, ever -- a second store.index.tsx mount (switching
  // stores, a refetch) must not re-stamp or touch an already-set value.
  useEffect(() => {
    if (!storeId || !themeLoaded || !complete || onboardedAt) return;
    let cancelled = false;
    supabase
      .from("stores")
      .update({ onboarded_at: new Date().toISOString() })
      .eq("id", storeId)
      .is("onboarded_at", null)
      .select("onboarded_at")
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          // Not fatal: `complete` is still derived live and gets the seller
          // to the dashboard regardless. Only the one-way latch is missing
          // until a later render (or a later visit) tries the stamp again.
          console.error("useStoreSetupStatus: failed to stamp onboarded_at", error);
          return;
        }
        if (data?.onboarded_at) setOnboardedAt(data.onboarded_at);
      });
    return () => {
      cancelled = true;
    };
  }, [storeId, themeLoaded, complete, onboardedAt]);

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
    payoutStatus,
    locationCount,
    productCount,
    themeIdSet,
    installedApp: hasInstalledApp(user),
    complete,
    nextStepLabel,
    setLocationCount,
    onboardedAt,
    failed,
    retry,
  };
}
