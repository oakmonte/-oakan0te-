import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { setAccountPassword, signInWithPassword, signOut } from "@/lib/auth";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { checkPassword, MIN_PASSWORD_LENGTH } from "@/lib/password-policy";
import { FormError, OnboardingChecking } from "@/components/onboarding/OnboardingShell";
import { useRequireSession } from "@/components/onboarding/use-require-session";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings & Privacy — Oakmonte" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { checking } = useRequireSession();
  const [email, setEmail] = useState<string | null>(null);
  const [hasPassword, setHasPassword] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      setEmail(data.user.email ?? null);
      setHasPassword(data.user.user_metadata?.has_password === true);
    });
  }, []);

  if (checking) return <OnboardingChecking />;

  return (
    <div className="min-h-dvh bg-brand-bg text-brand-text">
      <header className="px-6 sm:px-10 py-6 flex items-center justify-between border-b border-brand-text/10">
        <h1 className="font-serif text-2xl">Settings &amp; Privacy</h1>
        <Link
          to="/"
          className="text-[11px] uppercase tracking-widest hover:text-brand-accent transition-colors"
        >
          ← Back
        </Link>
      </header>

      <main className="px-6 sm:px-10 py-8 max-w-sm mx-auto">
        <h2 className="text-xs uppercase tracking-widest text-brand-text/50 mb-4">Account</h2>
        <PasswordSection email={email} hasPassword={hasPassword} />

        <button
          type="button"
          onClick={() => signOut()}
          className="mt-10 text-[11px] uppercase tracking-widest text-brand-text/50 hover:text-brand-text transition-colors"
        >
          Sign out
        </button>
      </main>
    </div>
  );
}

function PasswordSection({ email, hasPassword }: { email: string | null; hasPassword: boolean }) {
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const verdict = checkPassword(password, [email ?? ""]);

  const reset = () => {
    setCurrentPassword("");
    setPassword("");
    setConfirm("");
    setError(null);
    setDone(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!verdict.ok) {
      setError(`Your new password needs ${verdict.problems.join(", ")}.`);
      return;
    }
    if (password !== confirm) {
      setError("Those two passwords don't match.");
      return;
    }

    setSaving(true);

    // Re-verifying the current password here (rather than trusting the
    // existing session) means a device left signed in can't be used to lock
    // the real owner out by silently swapping their password.
    if (hasPassword) {
      if (!email) {
        setSaving(false);
        setError("Something went wrong. Please try again.");
        return;
      }
      const { error: verifyError } = await signInWithPassword(email, currentPassword);
      if (verifyError) {
        setSaving(false);
        setError("Your current password doesn't match.");
        return;
      }
    }

    const { error: updateError } = await setAccountPassword(password);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDone(true);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between py-4 border-b border-brand-text/10 text-left"
      >
        <span className="text-sm">{hasPassword ? "Change password" : "Set a password"}</span>
        <span className="text-brand-text/40">→</span>
      </button>
    );
  }

  if (done) {
    return (
      <div className="py-4 border-b border-brand-text/10">
        <p className="text-sm">Password {hasPassword ? "changed" : "set"}.</p>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="mt-2 text-[11px] uppercase tracking-widest text-brand-text/50 hover:text-brand-text transition-colors"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="py-4 border-b border-brand-text/10">
      <form onSubmit={handleSubmit} className="space-y-3">
        {hasPassword && (
          <>
            <label htmlFor="current-password" className="sr-only">
              Current password
            </label>
            <input
              id="current-password"
              type={show ? "text" : "password"}
              required
              autoFocus
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Current password"
              className="w-full rounded-full border border-brand-text/25 bg-transparent px-5 py-3.5 text-sm placeholder:text-brand-text/40 focus:outline-none focus:border-brand-accent transition-colors"
            />
          </>
        )}

        <label htmlFor="new-password" className="sr-only">
          New password
        </label>
        <input
          id="new-password"
          type={show ? "text" : "password"}
          required
          autoFocus={!hasPassword}
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={`New password (${MIN_PASSWORD_LENGTH}+ characters)`}
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
          Confirm new password
        </label>
        <input
          id="confirm-password"
          type={show ? "text" : "password"}
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm new password"
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
          Show passwords
        </label>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              reset();
              setOpen(false);
            }}
            className="flex-1 rounded-full border border-brand-text/25 py-3.5 text-sm font-medium uppercase tracking-widest hover:border-brand-text/50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={
              saving || !verdict.ok || password !== confirm || (hasPassword && !currentPassword)
            }
            className="flex-1 rounded-full bg-brand-accent text-brand-bg py-3.5 text-sm font-medium uppercase tracking-widest hover:bg-brand-accent/90 transition-all duration-300 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
        <FormError>{error}</FormError>
      </form>
    </div>
  );
}
