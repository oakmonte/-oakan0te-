import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import {
  isPasskeySupported,
  markPasskeyPrompted,
  needsPasskeyForInstall,
  needsPasskeyOffer,
  registerPasskey,
  resolvePostAuthRedirect,
} from "@/lib/auth";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/spinner";

export const Route = createFileRoute("/passkey")({
  // Whitelisted to the one destination that sends people here, rather than
  // accepting whatever string is in the URL. This screen is reached while
  // signed in, so an arbitrary `next` would be an open redirect wearing a
  // helpful name.
  validateSearch: (search: Record<string, unknown>): { next?: "/store" } => ({
    next: search.next === "/store" ? "/store" : undefined,
  }),
  head: () => ({
    // White page, so the iOS status strip must be white too — the root
    // default is #000000 and would otherwise paint a black band above it.
    meta: [{ name: "theme-color", content: "#ffffff" }],
  }),
  component: PasskeyStep,
});

// Offered once per account, from the seller checklist immediately after the
// payout step, to the people a passkey actually rescues -- see
// needsPasskeyForInstall. The caller gates it; this screen re-checks anyway,
// because the route is reachable by typing the URL.
//
// Placement is the whole feature. The same screen shown during signup gets
// skipped on reflex; shown right after someone types their bank details, it
// reads as part of setting up a business.
//
// This screen sits between a successful sign-in and the app, which is the only
// thing about it that is dangerous: someone stuck here cannot rescue
// themselves by signing in again, because they are already signed in. So every
// path out of it leads forward. The WebAuthn call is wrapped, a failure offers
// to move on rather than retrying forever, and navigation never waits on the
// metadata write -- a failed write costs us one extra ask next time, which is
// the cheaper of the two ways to be wrong.
function PasskeyStep() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const [enabled, setEnabled] = useState(true);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  // Direct navigation here by someone signed out, or on a device with no
  // platform authenticator, should not strand them on a screen whose only
  // button opens a dialog that cannot appear.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data }, supported] = await Promise.all([
        supabase.auth.getSession(),
        isPasskeySupported(),
      ]);
      if (cancelled) return;
      if (!data.session) {
        navigate({ to: "/sign-in", replace: true });
        return;
      }
      // Unsupported, already answered once, or not someone a passkey would
      // rescue: leave the flag as it is and move on quietly. store.finance
      // checks all three before sending anyone here, but the route is a URL
      // and can be typed, so it cannot trust the caller.
      const { data: userData } = await supabase.auth.getUser();
      if (cancelled) return;
      if (
        !supported ||
        !needsPasskeyOffer(userData.user) ||
        !needsPasskeyForInstall(userData.user)
      ) {
        void leave(data.session.user.id, { mark: false });
        return;
      }
      // Only now is the offer real. Until this point the screen stays inert:
      // tapping Next during the two round-trips above would enrol a credential
      // for someone the gate is in the middle of turning away, and race two
      // navigations.
      setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function leave(userId: string, { mark }: { mark: boolean }) {
    // Deliberately not awaited. The write is bookkeeping; a stalled updateUser
    // on a flaky connection must never hold someone on this screen. Losing it
    // costs one extra ask later.
    if (mark) void markPasskeyPrompted();
    // Mid-checklist: go back to where they came from. Resolving instead would
    // send a seller who already has a store to their profile, dropping them
    // out of store setup at step two.
    if (next === "/store") {
      navigate({ to: "/store", replace: true });
      return;
    }
    try {
      const redirect = await resolvePostAuthRedirect(userId);
      navigate({ ...redirect, replace: true });
    } catch (err) {
      // The one thing this screen must never do is keep someone. They are
      // already signed in, so signing in again rescues nothing -- a worse
      // destination beats a dead end.
      console.error("passkey leave: could not resolve a destination", err);
      navigate({ to: "/", replace: true });
    }
  }

  async function currentUserId() {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  }

  const handleNext = async () => {
    setBusy(true);
    setFailed(null);
    try {
      const userId = await currentUserId();
      if (!userId) {
        navigate({ to: "/sign-in", replace: true });
        return;
      }

      if (!enabled) {
        // A deliberate decline, already warned about below. Mark it, so we stop
        // asking someone who has told us no.
        await leave(userId, { mark: true });
        return;
      }

      try {
        const { error } = await registerPasskey();
        if (error) {
          // Cancelling the system sheet lands here too, and that is not a "no" —
          // it is a not-now. Leave the flag unset and offer a way forward.
          //
          // An account that already HAS a passkey can also land here, when an
          // earlier markPasskeyPrompted write was lost, so the copy must not
          // insist the device failed at something it may have done already.
          setFailed(
            "That didn't complete. Try again, or skip — if you've already set this up, you're fine.",
          );
          setBusy(false);
          return;
        }
      } catch {
        setFailed("This device wouldn't set up a passkey. You can skip and carry on.");
        setBusy(false);
        return;
      }

      await leave(userId, { mark: true });
    } catch (err) {
      // currentUserId refreshes the token over the network, so it rejects on a
      // dropped connection. Without this the spinner would stick and disable
      // both buttons on a screen nobody can sign back out of.
      console.error("passkey step failed", err);
      setFailed("Something went wrong. Try again, or skip for now.");
      setBusy(false);
    }
  };

  const handleSkipAfterFailure = async () => {
    setBusy(true);
    try {
      const userId = await currentUserId();
      if (!userId) {
        navigate({ to: "/sign-in", replace: true });
        return;
      }
      await leave(userId, { mark: false });
    } catch (err) {
      // Same reasoning, and this is the escape hatch itself -- it has to work
      // when everything else already failed.
      console.error("passkey skip failed", err);
      navigate({ to: next === "/store" ? "/store" : "/", replace: true });
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center px-6 py-10 bg-white text-[#0A0A0A]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="inline-flex p-3 rounded-full bg-[#0A0A0A]/5 mb-5">
            <ShieldCheck size={22} className="text-[#0A0A0A]" />
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl leading-tight">
            Stay signed in on your phone
          </h1>
          <p className="mt-3 text-sm text-[#0A0A0A]/70">
            When you add Oakmonte to your home screen, it asks you to sign in again. Turn this on
            and Face ID handles it — no password, no waiting for a code.
          </p>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#0A0A0A]/10 px-4 py-4">
          <div>
            <p className="text-sm font-medium">Sign in with Face ID</p>
            <p className="text-xs text-[#0A0A0A]/60 mt-0.5">Or Touch ID — recommended</p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={(next) => {
              setEnabled(next);
              setDeclining(!next);
              setFailed(null);
            }}
            aria-label="Enable signing in with Face ID"
          />
        </div>

        {declining && !enabled && (
          <p className="mt-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-900">
            Without this you&apos;ll have to sign in from scratch every time you add Oakmonte to a
            new device — password or an emailed code, and codes can be slow. You can turn it on
            later in settings.
          </p>
        )}

        {failed && <p className="mt-4 text-xs text-red-500 text-center">{failed}</p>}

        <button
          type="button"
          onClick={handleNext}
          disabled={busy || checking}
          className="mt-8 w-full flex items-center justify-center bg-[#0A0A0A] text-white rounded-full py-3.5 text-sm font-medium hover:bg-[#0A0A0A]/85 transition-all duration-300 disabled:opacity-60"
        >
          {busy || checking ? <Spinner /> : enabled ? "Next" : "Continue without it"}
        </button>

        {failed && (
          <button
            type="button"
            onClick={handleSkipAfterFailure}
            disabled={busy}
            className="mt-3 w-full text-center text-[11px] uppercase tracking-widest text-[#0A0A0A]/60 hover:text-[#0A0A0A] transition-colors disabled:opacity-60"
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
}
