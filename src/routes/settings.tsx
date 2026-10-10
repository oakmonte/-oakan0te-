import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ChevronRight } from "lucide-react";
import { setAccountPassword, signInWithPassword, signOut } from "@/lib/auth";
import { authedFetch } from "@/lib/authed-fetch";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { checkPassword, MIN_PASSWORD_LENGTH } from "@/lib/password-policy";
import { useRequireSession } from "@/components/onboarding/use-require-session";
import { useActiveStore } from "@/hooks/use-own-store";
import { fetchReadReceipts, setReadReceipts } from "@/lib/chat/api";
import { BackButton } from "@/components/BackButton";

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
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      setUserId(data.user.id);
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
        {/* `to: ".."` used to resolve to `/` — the marketing landing page —
            because these are flat top-level routes, not nested ones. */}
        <BackButton className="absolute left-6" />
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

        {userId && <MessagesSection userId={userId} />}

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

function Switch({
  checked,
  label,
  onClick,
  disabled,
}: {
  checked: boolean;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 disabled:opacity-60 ${
        checked ? "bg-white" : "bg-white/20"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-black transition-transform duration-200 ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

/** WhatsApp's rule, enforced by RLS (20260929120000_read_receipts_setting):
 *  off means nobody sees when you've read their messages, and you don't see
 *  when they've read yours. Delivered ticks are unaffected. */
function MessagesSection({ userId }: { userId: string }) {
  const [readReceipts, setReadReceiptsState] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchReadReceipts(userId).then((on) => {
      if (!cancelled) setReadReceiptsState(on);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function toggle() {
    if (readReceipts === null || saving) return;
    const next = !readReceipts;
    setSaving(true);
    setReadReceiptsState(next);
    try {
      await setReadReceipts(userId, next);
    } catch (error) {
      console.error("MessagesSection: failed to save read receipts", error);
      setReadReceiptsState(!next);
    } finally {
      setSaving(false);
    }
  }

  // Also null while the setting doesn't exist on this database yet.
  if (readReceipts === null) return null;

  return (
    <Section title="Messages">
      <Panel>
        <div className="flex items-center justify-between gap-3 px-4 py-3.5">
          <span className="text-[14px] text-white/70">
            Read receipts
            <span className="block text-[12px] text-white/40 mt-0.5">
              If you turn this off, people won't see when you've read their messages, and you won't
              see when they've read yours. Delivered ticks still show.
            </span>
          </span>
          <Switch checked={readReceipts} label="Read receipts" onClick={toggle} disabled={saving} />
        </div>
      </Panel>
    </Section>
  );
}

/** Only rendered for accounts that actually have a store — creators/curators
 *  with no stores row see no "Store" section at all, same as how the rest of
 *  this page only shows what applies to the signed-in account. */
// Sellers-only: the store is the account, so the old dual-account switches
// (sell only from personal / store page, hide store from profile) are gone.
function StoreSection() {
  const { storeId, loading: storeLoading } = useActiveStore();
  // Set once during onboarding (seller-type); changeable here afterwards.
  const [customOrders, setCustomOrders] = useState<boolean | null>(null);
  const [savingCustom, setSavingCustom] = useState(false);
  // Shown to buyers from the storefront footer's Shipping Policy pop-up.
  const [policy, setPolicy] = useState("");
  const [savedPolicy, setSavedPolicy] = useState("");
  const [policyState, setPolicyState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    if (!storeId) {
      setCustomOrders(null);
      return;
    }
    let cancelled = false;
    supabase
      .from("stores")
      .select("offers_custom_orders, shipping_policy")
      .eq("id", storeId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error("StoreSection: failed to load store", error);
        setCustomOrders(data?.offers_custom_orders ?? false);
        setPolicy(data?.shipping_policy ?? "");
        setSavedPolicy(data?.shipping_policy ?? "");
      });
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  async function toggleCustomOrders() {
    if (!storeId || savingCustom || customOrders === null) return;
    const next = !customOrders;
    setSavingCustom(true);
    setCustomOrders(next);
    const { error } = await supabase
      .from("stores")
      .update({ offers_custom_orders: next })
      .eq("id", storeId);
    setSavingCustom(false);
    if (error) {
      console.error("StoreSection: failed to save offers_custom_orders", error);
      setCustomOrders(!next);
    }
  }

  async function savePolicy() {
    if (!storeId) return;
    const next = policy.trim();
    setPolicyState("saving");
    const { error } = await supabase
      .from("stores")
      .update({ shipping_policy: next || null })
      .eq("id", storeId);
    if (error) {
      console.error("StoreSection: failed to save shipping_policy", error);
      setPolicyState("error");
      return;
    }
    setSavedPolicy(next);
    setPolicy(next);
    setPolicyState("saved");
  }

  if (storeLoading || !storeId || customOrders === null) return null;

  return (
    <Section title="Store">
      <Panel>
        <div className="flex items-center justify-between gap-3 px-4 py-3.5">
          <span className="text-[14px] text-white/70">
            I offer custom orders
            <span className="block text-[12px] text-white/40 mt-0.5">
              Lets shoppers know you take made-to-order requests.
            </span>
          </span>
          <Switch
            checked={customOrders}
            label="I offer custom orders"
            onClick={toggleCustomOrders}
            disabled={savingCustom}
          />
        </div>
        <div className="px-4 py-3.5">
          <span className="text-[14px] text-white/70">
            Shipping policy
            <span className="block text-[12px] text-white/40 mt-0.5">
              Shown to shoppers from the bottom of your website. Leave it empty to hide it.
            </span>
          </span>
          <textarea
            value={policy}
            onChange={(e) => {
              setPolicy(e.target.value.slice(0, 2000));
              setPolicyState("idle");
            }}
            rows={4}
            placeholder="e.g. Orders are processed within 2–3 days. Delivery timelines depend on your location."
            className={`${inputClass} mt-3 resize-none leading-relaxed`}
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-[12px] text-white/40">
              {policyState === "saved"
                ? "Saved"
                : policyState === "error"
                  ? "Couldn't save. Try again."
                  : `${policy.length}/2000`}
            </span>
            <button
              type="button"
              onClick={() => void savePolicy()}
              disabled={policyState === "saving" || policy.trim() === savedPolicy.trim()}
              className="rounded-full bg-white px-5 py-2 text-[13px] font-semibold text-black disabled:opacity-40"
            >
              {policyState === "saving" ? "Saving…" : "Save"}
            </button>
          </div>
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

  // Uncontrolled inputs, read through refs at submit time: Safari's "Suggest
  // Strong Password" writes the DOM value without telling React, so a
  // controlled `value` snaps it back to empty on the next render (including
  // the one "Show passwords" causes) and state-gated buttons stay disabled.
  // Same fix and reasoning as /create-password.
  const currentRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

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

    const currentPwd = currentRef.current?.value ?? currentPassword;
    const pwd = passwordRef.current?.value ?? password;
    const conf = confirmRef.current?.value ?? confirm;
    const freshVerdict = checkPassword(pwd, [email ?? ""]);

    if (!freshVerdict.ok) {
      setError(`Your new password needs ${freshVerdict.problems.join(", ")}.`);
      return;
    }
    if (pwd !== conf) {
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
      const { error: verifyError } = await signInWithPassword(email, currentPwd);
      if (verifyError) {
        setSaving(false);
        setError("Your current password doesn't match.");
        return;
      }
    }

    const { error: updateError } = await setAccountPassword(pwd);
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
        {!hasPassword && email && (
          <p className="px-1 text-[12px] leading-relaxed text-white/50">
            Set a password to sign in with just your email and password, alongside Apple or Google.
            Your email for sign-in is <span className="text-white/80">{email}</span>.
          </p>
        )}
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
              ref={currentRef}
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
          ref={passwordRef}
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
          ref={confirmRef}
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
            disabled={saving}
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
