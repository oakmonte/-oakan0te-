import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Landmark, Clock, Check } from "lucide-react";
import { PayoutAccountSheet } from "@/components/store/PayoutAccountSheet";
import { authedFetch } from "@/lib/authed-fetch";
import { isPasskeySupported, needsPasskeyForInstall, needsPasskeyOffer } from "@/lib/auth";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { payoutStepState } from "@/lib/setup-step-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type PayoutAccount = {
  bank_name: string;
  account_number: string;
  status: string;
};

function maskAccountNumber(number: string) {
  if (number.length <= 4) return number;
  return `•••• ${number.slice(-4)}`;
}

export const Route = createFileRoute("/store/finance")({
  validateSearch: (search: Record<string, unknown>): { checklist?: boolean } => ({
    checklist: search.checklist === true || search.checklist === "true" ? true : undefined,
  }),
  component: FinancePage,
});

function FinancePage() {
  const navigate = useNavigate();
  const { checklist } = Route.useSearch();
  // undefined = still loading, null = no account saved yet
  const [account, setAccount] = useState<PayoutAccount | null | undefined>(undefined);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [skipPromptOpen, setSkipPromptOpen] = useState(false);
  const [nextBusy, setNextBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    authedFetch("/api/store/payout")
      .then((res) => res.json())
      .then((body) => {
        if (!cancelled) setAccount(body.account ?? null);
      })
      // Without this, a handler that 500s (or a proxy that returns an HTML
      // error page, so .json() throws) leaves `account` as undefined forever
      // and the page sits on its loading state with nothing to explain why.
      .catch((err) => {
        console.error("payout load failed", err);
        if (!cancelled) setAccount(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // No account yet is exactly the case this checklist step exists to catch —
  // nudge before letting them past it, rather than silently letting "Next"
  // skip the one thing this page is for.
  function handleNext() {
    if (!account) {
      setSkipPromptOpen(true);
      return;
    }
    void continueToStore();
  }

  // The passkey offer lives here, and only here, on purpose. Someone who has
  // just typed their bank account number is in the middle of setting up a
  // business and reads a security prompt as part of that; the same screen
  // during signup reads as an obstacle and gets skipped. See
  // needsPasskeyForInstall for who is asked (iOS, non-Apple) and why nobody
  // else is.
  //
  // It is also load-bearing for the step three cards further down the
  // checklist. "Get the webapp" asks them to install the app and carry on from
  // inside it, and on iOS the installed app starts signed out -- so the passkey
  // made here is what turns that second sign-in into Face ID instead of a
  // retyped password. Move this earlier or later and that still works; remove
  // it and the install step quietly gets much harder to finish.
  //
  // Deliberately NOT on the "Continue anyway" path below: that seller just
  // declined to enter their details, and asking them for a fingerprint in the
  // same breath throws away the one thing that makes this placement work.
  async function continueToStore() {
    setNextBusy(true);
    try {
      const { data } = await supabase.auth.getUser();
      if (
        needsPasskeyOffer(data.user) &&
        needsPasskeyForInstall(data.user) &&
        (await isPasskeySupported())
      ) {
        navigate({ to: "/passkey", search: { next: "/store" } });
        return;
      }
    } catch (err) {
      // An offer is optional; finishing the checklist step is not. Never let a
      // failed lookup strand someone on a page whose only button did nothing.
      console.error("passkey gate failed", err);
    }
    navigate({ to: "/store" });
  }

  async function handleSave(values: { bankName: string; accountNumber: string }) {
    const res = await authedFetch("/api/store/payout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    // A non-JSON body means the request never reached the handler at all --
    // most often a missing server env var turning into an error page. Read it
    // as text in that case so the seller gets a status code rather than a
    // parser exception swallowed by the caller.
    const raw = await res.text();
    let body: { account?: PayoutAccount; error?: string } = {};
    try {
      body = JSON.parse(raw);
    } catch {
      throw new Error(`The server didn't respond properly (${res.status}). Please try again.`);
    }

    if (!res.ok) {
      // 401 is its own message: the fix is to sign in again, not to retry.
      throw new Error(
        res.status === 401
          ? "Your session has expired — sign in again and retry."
          : (body.error ?? `Could not save your payout account (${res.status}).`),
      );
    }

    setAccount(body.account ?? null);
    setSheetOpen(false);
  }

  return (
    <div className="px-4 py-6">
      <h1 className="text-lg font-semibold mb-1">Finance</h1>
      <p className="text-sm text-sd-ink-muted mb-6">
        Where your payouts go once your store starts selling.
      </p>

      {account === undefined && (
        <div className="border border-sd-line rounded-2xl h-32 bg-sd-elevated animate-pulse" />
      )}

      {account === null && (
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="w-full flex flex-col items-center gap-3 border border-dashed border-sd-line rounded-2xl p-8 text-center oak-motion-control animate-in fade-in duration-300"
        >
          <div className="p-3 rounded-full bg-sd-soft">
            <Landmark size={20} className="text-sd-ink-muted" />
          </div>
          <div>
            <p className="text-sm font-medium text-sd-ink">Add your payout account</p>
            <p className="text-xs text-sd-ink-muted mt-0.5">So we know where to send your money.</p>
          </div>
        </button>
      )}

      {account && (
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="w-full text-left bg-sd-ink text-sd-bg rounded-2xl p-5 flex flex-col gap-5 oak-motion-control animate-in fade-in duration-300"
        >
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-full bg-sd-bg/10">
              <Landmark size={18} />
            </div>
            {/* Derived, not hardcoded. This badge used to say "Pending
                verification" unconditionally while the copy below promised it
                would "flip to Verified automatically" -- a promise nothing in
                the component could have kept. It now reads the same rule the
                setup checklist's status mark does, so the two screens cannot
                disagree about the same account. */}
            {payoutStepState(true, account.status) === "done" ? (
              <span className="flex items-center gap-1.5 text-[11px] font-medium bg-emerald-400/15 text-emerald-300 rounded-full px-2.5 py-1">
                <Check size={11} />
                Verified
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[11px] font-medium bg-amber-400/15 text-amber-300 rounded-full px-2.5 py-1">
                <Clock size={11} />
                Pending verification
              </span>
            )}
          </div>
          <div>
            <p className="text-lg font-mono tracking-wider">
              {maskAccountNumber(account.account_number)}
            </p>
            <p className="text-sm text-sd-bg/70 mt-1">{account.bank_name}</p>
          </div>
        </button>
      )}

      {account && payoutStepState(true, account.status) !== "done" && (
        <p className="text-xs text-sd-ink-faint mt-4 animate-in fade-in duration-300">
          Actively verifying your account. If it is verified, this card flips to
          &quot;Verified&quot; automatically, no re-entry needed.
        </p>
      )}

      {sheetOpen && (
        <PayoutAccountSheet
          initial={
            account ? { bankName: account.bank_name, accountNumber: account.account_number } : null
          }
          onSave={handleSave}
          onClose={() => setSheetOpen(false)}
        />
      )}

      {checklist && (
        <div className="mt-8">
          <button
            type="button"
            onClick={handleNext}
            disabled={nextBusy}
            className="w-full bg-sd-ink text-sd-bg text-sm font-semibold rounded-full py-4 oak-motion-control active:scale-[0.98] disabled:opacity-60"
          >
            Next
          </button>
        </div>
      )}

      <Dialog open={skipPromptOpen} onOpenChange={setSkipPromptOpen}>
        <DialogContent className="w-[calc(100%-32px)] max-w-sm gap-7 rounded-[28px] border-sd-line bg-sd-surface px-6 pb-7 pt-8 text-sd-ink">
          <DialogHeader className="text-left">
            <DialogTitle className="text-[22px] leading-tight">Add a payout account?</DialogTitle>
            <DialogDescription className="pt-2 text-[15px] leading-relaxed text-sd-ink-muted">
              You won&apos;t be able to receive payouts until you add one. You can always come back
              to this later.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => {
                setSkipPromptOpen(false);
                setSheetOpen(true);
              }}
              className="w-full rounded-2xl bg-sd-ink py-[18px] text-[17px] font-semibold text-sd-bg oak-motion-control active:scale-[0.98]"
            >
              Add payout account
            </button>
            <button
              type="button"
              onClick={() => {
                setSkipPromptOpen(false);
                navigate({ to: "/store" });
              }}
              className="w-full rounded-2xl border border-sd-line py-[18px] text-[17px] font-medium text-sd-ink oak-motion-control active:scale-[0.98]"
            >
              Continue anyway
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
