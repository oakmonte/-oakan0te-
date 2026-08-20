import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { needsPassword, resolvePostAuthRedirect, setAccountPassword, signOut } from "@/lib/auth";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { clearPasswordResetPending, isPasswordResetPending } from "@/lib/onboarding-state";
import { checkPassword, MIN_PASSWORD_LENGTH } from "@/lib/password-policy";
import { FormError, OnboardingChecking } from "@/components/onboarding/OnboardingShell";

export const Route = createFileRoute("/create-password")({
  head: () => ({ meta: [{ title: "Create a password — Oakmonte" }] }),
  component: CreatePasswordPage,
});

// Sits between code verification and onboarding proper, so it is deliberately
// not numbered as an onboarding step — it is an auth step, and Google users
// never see it.
function CreatePasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  /** True when this is a password RESET rather than a first-time set. */
  const [resetting, setResetting] = useState(false);
  // Fed to the policy so the password can't just be the user's own email.
  const [identifiers, setIdentifiers] = useState<string[]>([]);

  const verdict = checkPassword(password, identifiers);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(async ({ data }) => {
      if (cancelled) return;
      if (!data.user) {
        navigate({ to: "/sign-in", replace: true });
        return;
      }
      // Read and clear in one go: a reset is a one-shot handoff from the
      // sign-in form, so a later reload lands on the profile instead of
      // parking the user here forever.
      const resetting = isPasswordResetPending();
      clearPasswordResetPending();
      setResetting(resetting);

      // Google-only accounts, and anyone who already set one, skip straight on
      // — unless they got here from "Forgot password? Email me a code".
      if (!resetting && !needsPassword(data.user)) {
        const redirect = await resolvePostAuthRedirect(data.user.id);
        if (!cancelled) navigate({ ...redirect, replace: true });
        return;
      }
      setIdentifiers([data.user.email ?? ""]);
      setChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!verdict.ok) {
      setError(`Your password needs ${verdict.problems.join(", ")}.`);
      return;
    }
    if (password !== confirm) {
      setError("Those two passwords don't match.");
      return;
    }

    setSaving(true);
    const { data, error: updateError } = await setAccountPassword(password);
    if (updateError) {
      setSaving(false);
      setError(updateError.message);
      return;
    }

    const userId = data.user?.id;
    if (!userId) {
      setSaving(false);
      setError("Something went wrong. Please try again.");
      return;
    }

    const redirect = await resolvePostAuthRedirect(userId);
    setSaving(false);
    navigate({ ...redirect, replace: true });
  };

  if (checking) return <OnboardingChecking />;

  return (
    <div className="min-h-dvh bg-brand-bg text-brand-text flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm text-center">
        <h1 className="font-serif text-4xl sm:text-5xl leading-tight mb-3">
          {resetting ? "Set a new password" : "Create a password"}
        </h1>
        <p className="text-sm text-brand-text/70 mb-8">
          {resetting
            ? "This replaces the one you forgot. You'll be signed in on this device either way."
            : "So you can sign back in instantly, without waiting on a code every time."}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label htmlFor="new-password" className="sr-only">
            New password
          </label>
          <input
            id="new-password"
            type={show ? "text" : "password"}
            required
            autoFocus
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={`Password (${MIN_PASSWORD_LENGTH}+ characters)`}
            className="w-full rounded-full border border-brand-text/25 bg-transparent px-5 py-3.5 text-sm placeholder:text-brand-text/40 focus:outline-none focus:border-brand-accent transition-colors"
          />
          {password && (
            <div className="px-2 pt-1 text-left" aria-live="polite">
              <div className="flex items-center gap-1.5">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                      i < verdict.score
                        ? verdict.score >= 3
                          ? "bg-emerald-500"
                          : "bg-amber-500"
                        : "bg-brand-text/15"
                    }`}
                  />
                ))}
                <span className="ml-2 text-[10px] uppercase tracking-widest text-brand-text/50">
                  {verdict.label}
                </span>
              </div>
              {verdict.problems.length > 0 && (
                <p className="mt-1.5 text-[11px] text-brand-text/60">
                  Needs {verdict.problems.join(", ")}.
                </p>
              )}
            </div>
          )}

          <label htmlFor="confirm-password" className="sr-only">
            Confirm password
          </label>
          <input
            id="confirm-password"
            type={show ? "text" : "password"}
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirm password"
            className="w-full rounded-full border border-brand-text/25 bg-transparent px-5 py-3.5 text-sm placeholder:text-brand-text/40 focus:outline-none focus:border-brand-accent transition-colors"
          />

          {confirm && password !== confirm && (
            <p className="px-2 text-[11px] text-brand-text/60 text-left">
              Those two passwords don't match yet.
            </p>
          )}

          <label className="flex items-center gap-2 text-xs text-brand-text/60 px-2 py-1 cursor-pointer">
            <input
              type="checkbox"
              checked={show}
              onChange={(e) => setShow(e.target.checked)}
              className="accent-brand-accent"
            />
            Show password
          </label>

          <button
            type="submit"
            disabled={saving || !verdict.ok || password !== confirm}
            className="w-full rounded-full bg-brand-accent text-brand-bg py-3.5 text-sm font-medium uppercase tracking-widest hover:bg-brand-accent/90 hover:scale-[1.01] transition-all duration-300 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Continue"}
          </button>
          <FormError>{error}</FormError>
        </form>

        <button
          type="button"
          onClick={async () => {
            clearPasswordResetPending();
            await signOut();
            navigate({ to: "/sign-in", replace: true });
          }}
          className="mt-8 text-[11px] uppercase tracking-widest text-brand-text/50 hover:text-brand-text transition-colors"
        >
          Sign out instead
        </button>
      </div>
    </div>
  );
}
