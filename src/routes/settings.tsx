import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { setAccountPassword, signInWithPassword, signOut } from "@/lib/auth";
import { authedFetch } from "@/lib/authed-fetch";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { checkPassword, MIN_PASSWORD_LENGTH } from "@/lib/password-policy";
import { useRequireSession } from "@/components/onboarding/use-require-session";
import { useActiveStore } from "@/hooks/use-own-store";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings & Privacy — Oakmonte" }] }),
  component: SettingsPage,
});

// Matches the rest of the interior app (profile, edit-profile) — black,
// SF Pro, translucent white panels — not the light brand-serif look the
// onboarding/marketing routes use. This page is reached from inside the app,
// not from the landing flow, so it should look like the app it's part of.
const SF_PRO = "'SF Pro', system-ui, sans-serif";

function SettingsPage() {
  const navigate = useNavigate();
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

  // A local, black loading state — OnboardingChecking's white brand-bg
  // screen would flash between this page's black content and the black
  // profile page it's opened from.
  if (checking) {
    return (
      <div
        className="min-h-screen bg-black text-white flex items-center justify-center"
        style={{ fontFamily: SF_PRO }}
      >
        <span className="text-[14px] text-white/50">One moment…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white" style={{ fontFamily: SF_PRO }}>
      <div className="flex items-center justify-center relative px-6 pt-4 pb-4">
        <button
          onClick={() => navigate({ to: ".." })}
          aria-label="Back"
          className="absolute left-6"
        >
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-[16px] font-bold">Settings &amp; Privacy</h1>
      </div>

      <main className="px-4 pt-2 pb-16 max-w-md mx-auto space-y-7">
        <Section title="Account">
          <Panel>
            <FieldRow label="Email">
              <span className="text-[14px] text-white/50 truncate">{email ?? "—"}</span>
            </FieldRow>
            <PasswordRow email={email} hasPassword={hasPassword} />
          </Panel>
        </Section>

        <Section title="Profile">
          <Panel>
            <NavRow label="Edit profile" onClick={() => navigate({ to: "/edit-profile" })} />
          </Panel>
        </Section>

        <StoreSection />

        <Section title="Legal">
          <Panel>
            <NavRow label="Terms of Service" onClick={() => navigate({ to: "/terms" })} />
            <NavRow label="Privacy Policy" onClick={() => navigate({ to: "/privacy" })} />
          </Panel>
        </Section>

        <button
          type="button"
          onClick={async () => {
            await signOut();
            navigate({ to: "/", replace: true });
          }}
          className="w-full rounded-2xl bg-white/[0.06] py-3.5 text-[14px] font-semibold text-white text-center transition-colors duration-150 active:bg-white/[0.1]"
        >
          Sign out
        </button>

        <Section title="Danger zone">
          <Panel>
            <DeleteAccountSection email={email} hasPassword={hasPassword} />
          </Panel>
        </Section>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-white/40 mb-2 px-1">{title}</div>
      {children}
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/[0.06] divide-y divide-white/10 overflow-hidden">
      {children}
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5 gap-3">
      <span className="text-[14px] text-white/70 shrink-0">{label}</span>
      {children}
    </div>
  );
}

function NavRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between px-4 py-3.5 text-left"
    >
      <span className="text-[14px]">{label}</span>
      <ChevronRight size={16} className="text-white/30 shrink-0" />
    </button>
  );
}

/** Only rendered for accounts that actually have a store — creators/curators
 *  with no stores row see no "Store" section at all, same as how the rest of
 *  this page only shows what applies to the signed-in account. */
function StoreSection() {
  const { storeId, loading: storeLoading } = useActiveStore();
  const [personalOnly, setPersonalOnly] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!storeId) {
      setPersonalOnly(null);
      return;
    }
    let cancelled = false;
    supabase
      .from("stores")
      .select("personal_storefront_only")
      .eq("id", storeId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error("StoreSection: failed to load store", error);
        setPersonalOnly(data?.personal_storefront_only ?? false);
      });
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  async function toggle() {
    if (!storeId || personalOnly === null || saving) return;
    const next = !personalOnly;
    setSaving(true);
    setPersonalOnly(next);
    const { error } = await supabase
      .from("stores")
      .update({ personal_storefront_only: next })
      .eq("id", storeId);
    setSaving(false);
    if (error) {
      console.error("StoreSection: failed to save toggle", error);
      setPersonalOnly(!next);
    }
  }

  if (storeLoading || !storeId || personalOnly === null) return null;

  return (
    <Section title="Store">
      <Panel>
        <div className="flex items-center justify-between gap-3 px-4 py-3.5">
          <span className="text-[14px] text-white/70">
            Only sell from my personal page
            <span className="block text-[12px] text-white/40 mt-0.5">
              No separate store page — your listings live on your profile's Store tab instead.
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={personalOnly}
            aria-label="Only sell from my personal page"
            onClick={toggle}
            disabled={saving}
            className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 disabled:opacity-60 ${
              personalOnly ? "bg-white" : "bg-white/20"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-black transition-transform duration-200 ${
                personalOnly ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </Panel>
    </Section>
  );
}

const inputClass =
  "w-full rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3.5 text-[14px] text-white placeholder:text-white/30 focus:outline-none focus:border-white/40 transition-colors";

function PasswordRow({ email, hasPassword }: { email: string | null; hasPassword: boolean }) {
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
      <NavRow
        label={hasPassword ? "Change password" : "Set a password"}
        onClick={() => setOpen(true)}
      />
    );
  }

  if (done) {
    return (
      <div className="px-4 py-3.5">
        <p className="text-[14px] text-white/70">Password {hasPassword ? "changed" : "set"}.</p>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="mt-2 text-[11px] uppercase tracking-widest text-white/40 hover:text-white transition-colors"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
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
              className={inputClass}
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
          className={inputClass}
        />
        {password && (
          <div className="px-1 pt-1" aria-live="polite">
            <div className="flex items-center gap-1.5">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                    i < verdict.score
                      ? verdict.score >= 3
                        ? "bg-emerald-500"
                        : "bg-amber-500"
                      : "bg-white/15"
                  }`}
                />
              ))}
              <span className="ml-2 text-[10px] uppercase tracking-widest text-white/40">
                {verdict.label}
              </span>
            </div>
            {verdict.problems.length > 0 && (
              <p className="mt-1.5 text-[11px] text-white/40">
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
          className={inputClass}
        />
        {confirm && password !== confirm && (
          <p className="px-1 text-[11px] text-white/40">Those two passwords don't match yet.</p>
        )}

        <label className="flex items-center gap-2 text-[12px] text-white/50 px-1 py-1 cursor-pointer">
          <input
            type="checkbox"
            checked={show}
            onChange={(e) => setShow(e.target.checked)}
            className="accent-white"
          />
          Show passwords
        </label>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              reset();
              setOpen(false);
            }}
            className="flex-1 rounded-full border border-white/20 py-3 text-[13px] font-medium uppercase tracking-widest text-white/70 hover:border-white/40 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={
              saving || !verdict.ok || password !== confirm || (hasPassword && !currentPassword)
            }
            className="flex-1 rounded-full bg-white text-black py-3 text-[13px] font-semibold uppercase tracking-widest disabled:opacity-40 transition-opacity"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
        {error && <p className="text-[12px] text-red-400 text-center">{error}</p>}
      </form>
    </div>
  );
}

function DeleteAccountSection({
  email,
  hasPassword,
}: {
  email: string | null;
  hasPassword: boolean;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = confirmText.trim().toUpperCase() === "DELETE" && (!hasPassword || password);

  const handleDelete = async () => {
    if (!canSubmit || deleting) return;
    setError(null);
    setDeleting(true);

    // Same re-verification as changing a password: a device left signed in
    // shouldn't be enough on its own to destroy the account.
    if (hasPassword) {
      if (!email) {
        setDeleting(false);
        setError("Something went wrong. Please try again.");
        return;
      }
      const { error: verifyError } = await signInWithPassword(email, password);
      if (verifyError) {
        setDeleting(false);
        setError("Your password doesn't match.");
        return;
      }
    }

    const response = await authedFetch("/api/account/delete", { method: "POST" });
    if (!response.ok) {
      setDeleting(false);
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Could not delete your account. Please try again.");
      return;
    }

    await signOut();
    navigate({ to: "/", replace: true });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left"
      >
        <span className="text-[14px] text-red-400">Delete account</span>
        <ChevronRight size={16} className="text-red-400/40 shrink-0" />
      </button>
    );
  }

  return (
    <div className="px-4 py-4 space-y-3">
      <p className="text-[13px] text-white/60 leading-relaxed">
        This permanently deletes your profile, store, products and posts. This can&apos;t be undone.
      </p>

      {hasPassword && (
        <>
          <label htmlFor="delete-password" className="sr-only">
            Password
          </label>
          <input
            id="delete-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Confirm your password"
            className={inputClass}
          />
        </>
      )}

      <label htmlFor="delete-confirm" className="sr-only">
        Type DELETE to confirm
      </label>
      <input
        id="delete-confirm"
        type="text"
        autoComplete="off"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder='Type "DELETE" to confirm'
        className={inputClass}
      />

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setPassword("");
            setConfirmText("");
            setError(null);
          }}
          className="flex-1 rounded-full border border-white/20 py-3 text-[13px] font-medium uppercase tracking-widest text-white/70 hover:border-white/40 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={!canSubmit || deleting}
          className="flex-1 rounded-full bg-red-500 text-white py-3 text-[13px] font-semibold uppercase tracking-widest disabled:opacity-40 transition-opacity"
        >
          {deleting ? "Deleting…" : "Delete permanently"}
        </button>
      </div>
      {error && <p className="text-[12px] text-red-400 text-center">{error}</p>}
    </div>
  );
}
