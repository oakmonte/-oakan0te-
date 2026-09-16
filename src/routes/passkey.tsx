import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import {
  isPasskeySupported,
  markPasskeyPrompted,
  needsPasskeyOffer,
  registerPasskey,
  resolvePostAuthRedirect,
} from "@/lib/auth";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/spinner";

export const Route = createFileRoute("/passkey")({ component: PasskeyStep });

// Offered once per account, after onboarding finishes, to everyone whose
// device can actually make one (resolvePostAuthRedirect gates both).
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
  const [enabled, setEnabled] = useState(true);
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
      // Unsupported, or already answered once: leave the flag as it is and
      // move on quietly. Reached directly now that /welcome routes here, so
      // it cannot assume the caller already checked.
      const { data: userData } = await supabase.auth.getUser();
      if (!supported || !needsPasskeyOffer(userData.user)) {
        void leave(data.session.user.id, { mark: false });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function leave(userId: string, { mark }: { mark: boolean }) {
    if (mark) await markPasskeyPrompted();
    const redirect = await resolvePostAuthRedirect(userId);
    // If the metadata write failed, resolve sends us straight back here.
    // Going home is a worse destination than their profile but an infinitely
    // better one than a loop.
    if (redirect.to === "/passkey") {
      navigate({ to: "/", replace: true });
      return;
    }
    navigate({ ...redirect, replace: true });
  }

  async function currentUserId() {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  }

  const handleNext = async () => {
    setBusy(true);
    setFailed(null);
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
        setFailed(
          "That didn't complete. You can try again, or skip and set it up later in settings.",
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
  };

  const handleSkipAfterFailure = async () => {
    setBusy(true);
    const userId = await currentUserId();
    if (!userId) {
      navigate({ to: "/sign-in", replace: true });
      return;
    }
    await leave(userId, { mark: false });
  };

  return (
    <div className="min-h-dvh flex items-center justify-center px-6 py-10 bg-white text-[#0A0A0A]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="inline-flex p-3 rounded-full bg-[#0A0A0A]/5 mb-5">
            <ShieldCheck size={22} className="text-[#0A0A0A]" />
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl leading-tight">Skip the code next time</h1>
          <p className="mt-3 text-sm text-[#0A0A0A]/70">
            Sign in with Face ID, your fingerprint, or your phone&apos;s passcode — no email code to
            wait for.
          </p>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#0A0A0A]/10 px-4 py-4">
          <div>
            <p className="text-sm font-medium">Fast sign-in</p>
            <p className="text-xs text-[#0A0A0A]/60 mt-0.5">Recommended</p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={(next) => {
              setEnabled(next);
              setDeclining(!next);
              setFailed(null);
            }}
            aria-label="Enable fast sign-in"
          />
        </div>

        {declining && !enabled && (
          <p className="mt-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-900">
            Without this you&apos;ll need an emailed code every time you sign in on a new device —
            and codes can be slow to arrive. You can turn it on later in settings.
          </p>
        )}

        {failed && <p className="mt-4 text-xs text-red-500 text-center">{failed}</p>}

        <button
          type="button"
          onClick={handleNext}
          disabled={busy}
          className="mt-8 w-full flex items-center justify-center bg-[#0A0A0A] text-white rounded-full py-3.5 text-sm font-medium hover:bg-[#0A0A0A]/85 transition-all duration-300 disabled:opacity-60"
        >
          {busy ? <Spinner /> : enabled ? "Next" : "Continue without it"}
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
