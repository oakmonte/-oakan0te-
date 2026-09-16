import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  checkEmailRegistered,
  resolvePostAuthRedirect,
  sendEmailCode,
  signInWithGoogle,
  signInWithPassword,
  verifyEmailCode,
} from "@/lib/auth";
import {
  clearIntent,
  setIntent,
  setPasswordResetPending,
  type Intent,
} from "@/lib/onboarding-state";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { isStandalone } from "@/lib/standalone";
import { GoogleIcon } from "@/components/auth-icons";
import { Spinner } from "@/components/spinner";
import { CodeInput } from "@/components/onboarding/CodeInput";
import { FormError, OnboardingChecking } from "@/components/onboarding/OnboardingShell";
import logoO from "@/assets/logo-o.png";

const RESEND_SECONDS = 30;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Mode = "code" | "password";
type Busy = "google" | "send" | "verify" | "password" | null;
type EmailStatus = "idle" | "checking" | "registered" | "unregistered";

type Props = {
  /** The flow this page starts. `null` on /sign-in, which is for people who
   *  already have an account and whose intent is recorded on their profile. */
  intent: Intent | null;
  title: string;
  subtitle: string;
  defaultMode?: Mode;
};

export function AuthPanel({ intent, title, subtitle, defaultMode = "code" }: Props) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [emailStatus, setEmailStatus] = useState<EmailStatus>("idle");

  // Someone who is already signed in used to be shown the sign-in form again,
  // most visibly when /no-account sent them back here to pick an intent.
  useEffect(() => {
    let cancelled = false;
    if (intent) setIntent(intent);
    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      if (!data.session) {
        setCheckingSession(false);
        return;
      }
      const redirect = await resolvePostAuthRedirect(data.session.user.id, intent);
      if (!cancelled) navigate({ ...redirect, replace: true });
    });
    return () => {
      cancelled = true;
    };
  }, [intent, navigate]);

  useEffect(() => {
    if (!sent || countdown <= 0) return;
    const t = setInterval(() => setCountdown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [sent, countdown]);

  // Debounced live check, same shape as choose-username's availability check —
  // a hint only, and only worth running before a code/password has actually
  // been sent/submitted. Powers the "you already have an account, sign in
  // instead" banner on the onboarding pages and the "no account with that
  // email yet" banner on /sign-in — an explicit, accepted enumeration
  // trade-off (see the is_email_registered migration and checkEmailRegistered).
  useEffect(() => {
    const trimmed = email.trim();
    if (sent || !EMAIL_RE.test(trimmed)) {
      setEmailStatus("idle");
      return;
    }
    let cancelled = false;
    setEmailStatus("checking");
    const t = setTimeout(async () => {
      const { data, error: rpcError } = await checkEmailRegistered(trimmed);
      if (cancelled) return;
      if (rpcError) {
        console.error("AuthPanel: email registration check failed", rpcError);
        setEmailStatus("idle");
        return;
      }
      setEmailStatus(data ? "registered" : "unregistered");
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [email, sent]);

  // In the installed app, Google is the weaker option and leads with a trap:
  // iOS renders its sign-in in a sheet that cannot reach the platform
  // authenticator, so anyone whose Google account is passkey-first gets a QR
  // code and no way through (see signInWithGoogle). The email code always
  // works there. So the installed app puts email first and demotes Google
  // below it, rather than labelling the button with which app you are in --
  // nobody reads that, and the order itself is the instruction.
  //
  // Set from an effect, not a lazy initial value: isStandalone() reads
  // `window`, so seeding state with it would render differently on the server
  // than on the client's first pass and trip hydration.
  const [emailFirst, setEmailFirst] = useState(false);
  useEffect(() => {
    setEmailFirst(isStandalone());
  }, []);

  const finish = async (userId: string) => {
    const redirect = await resolvePostAuthRedirect(userId, intent);
    navigate({ ...redirect, replace: true });
  };

  const handleGoogle = async () => {
    // /sign-in passes intent=null: this is a returning-user attempt, so any
    // intent left over from an abandoned flow on this browser must not leak
    // into the OAuth round-trip (auth.callback.tsx has no way to pass a hint
    // and falls back to reading storage — see clearIntent's doc comment).
    if (intent) setIntent(intent);
    else clearIntent();
    setError(null);
    setBusy("google");
    const { error: oauthError } = await signInWithGoogle();
    if (oauthError) {
      setError(oauthError.message);
      setBusy(null);
    }
  };

  const googleButton = (
    <button
      type="button"
      onClick={handleGoogle}
      disabled={busy === "google"}
      className="w-full flex items-center justify-center gap-3 bg-[#0A0A0A] text-white rounded-full py-3.5 text-sm font-medium hover:bg-[#0A0A0A]/85 hover:scale-[1.01] transition-all duration-300 disabled:opacity-60"
    >
      {busy === "google" ? (
        <Spinner />
      ) : (
        <>
          <GoogleIcon />
          Continue with Google
        </>
      )}
    </button>
  );

  const dividerWith = (label: string) => (
    <div className="flex items-center gap-4 my-8">
      <div className="flex-1 h-px bg-[#0A0A0A]/15" />
      <span className="text-[11px] uppercase tracking-widest text-[#0A0A0A]/50">{label}</span>
      <div className="flex-1 h-px bg-[#0A0A0A]/15" />
    </div>
  );

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    if (intent) setIntent(intent);
    else clearIntent();
    setError(null);
    setNotice(null);

    // /sign-in already told them, via the banner above, that this address has
    // no account — sending would just fail silently server-side (Supabase
    // refuses an OTP with shouldCreateUser:false for an unregistered address)
    // and this used to paper over that by showing "Check your email" anyway,
    // a dead end with no code ever arriving. Now that account existence is
    // deliberately revealed up front (see checkEmailRegistered / the
    // is_email_registered migration), there's no reason left to fake a send.
    if (intent === null && emailStatus === "unregistered") {
      setError("We couldn't find an account with that email — create one instead, above.");
      return;
    }

    setBusy("send");
    const { error: sendError } = await sendEmailCode(email.trim(), { createUser: intent !== null });
    setBusy(null);
    if (sendError) {
      // Fallback only, for the rare case the check above hasn't resolved yet
      // or failed silently — the debounced emailStatus check is what actually
      // decides this now, not this catch. Stays vague rather than surfacing
      // Supabase's raw error, so a slow/failed check doesn't itself become an
      // enumeration oracle.
      if (intent === null) {
        setSent(true);
        setCountdown(RESEND_SECONDS);
        return;
      }
      setError(sendError.message);
      return;
    }
    setSent(true);
    setCountdown(RESEND_SECONDS);
  };

  const handleResend = async () => {
    setError(null);
    setCode("");

    // Same reasoning as handleSend — see there.
    if (intent === null && emailStatus === "unregistered") {
      setError("We couldn't find an account with that email — create one instead, above.");
      return;
    }

    setBusy("send");
    const { error: sendError } = await sendEmailCode(email.trim(), { createUser: intent !== null });
    setBusy(null);
    if (sendError) {
      // Fallback only — see handleSend.
      if (intent !== null) setError(sendError.message);
      setCountdown(RESEND_SECONDS);
      return;
    }
    setCountdown(RESEND_SECONDS);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length < 6) return;
    setError(null);
    setBusy("verify");
    const { data, error: verifyError } = await verifyEmailCode(email.trim(), code);
    setBusy(null);
    if (verifyError) {
      setError("That code didn't work — check it and try again.");
      return;
    }
    const userId = data.session?.user.id;
    if (!userId) {
      setError("Something went wrong. Please try again.");
      return;
    }
    await finish(userId);
  };

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setError(null);
    setBusy("password");
    const { data, error: signInError } = await signInWithPassword(email.trim(), password);
    setBusy(null);
    if (signInError || !data.session) {
      setError("That email and password don't match. Try again, or use a code instead.");
      return;
    }
    await finish(data.session.user.id);
  };

  const switchToCode = () => {
    setMode("code");
    setError(null);
    setPassword("");
    // resolvePostAuthRedirect reads this after the code is verified and routes
    // to /create-password, so the notice below is actually kept.
    setPasswordResetPending();
    setNotice("No problem — we'll email you a 6-digit code, and you can set a new password after.");
  };

  const mm = String(Math.floor(countdown / 60)).padStart(2, "0");
  const ss = String(countdown % 60).padStart(2, "0");

  // Same screen as every other pre-onboarding session check (brand-bg #fff /
  // brand-text #0A0A0A are the same values this component used to hardcode
  // directly) — this is the one visitors actually land on first, from
  // /sign-in and the three intent pages, so it gets the same copy/font.
  if (checkingSession) {
    return <OnboardingChecking />;
  }

  return (
    <div data-onboarding className="min-h-dvh bg-white text-[#0A0A0A] flex flex-col">
      <header className="px-6 sm:px-10 py-6 flex items-center justify-between">
        <Link to="/" className="flex items-baseline gap-0.5">
          <img src={logoO} alt="" className="h-9 w-auto translate-y-0.5" />
          <span className="text-lg tracking-tight leading-none">akmonte</span>
        </Link>
        <Link
          to="/"
          className="text-[11px] uppercase tracking-widest hover:text-[#2151F5] transition-colors"
        >
          ← Back
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm">
          <div className="text-center mb-10">
            <h1 className="font-serif text-4xl sm:text-5xl leading-tight">{title}</h1>
            <p className="mt-3 text-sm text-[#0A0A0A]/70">{subtitle}</p>
          </div>

          {!emailFirst && (
            <>
              {googleButton}
              {dividerWith(
                mode === "password" ? "or sign in with email" : "or continue with email",
              )}
            </>
          )}

          {notice && <p className="mb-4 text-xs text-[#0A0A0A]/60 text-center">{notice}</p>}

          {/* Onboarding pages (intent set): this email already belongs to
              someone — steer them to sign in rather than let them quietly
              re-authenticate into their existing account through what still
              reads as a signup screen. */}
          {intent !== null && emailStatus === "registered" && (
            <div className="mb-4 rounded-xl border border-[#2151F5]/20 bg-[#2151F5]/5 px-4 py-3 text-xs text-[#0A0A0A]/70">
              You already have an account with this email.
              {mode !== "password" && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("password");
                    setError(null);
                  }}
                  className="ml-1 font-medium text-[#2151F5] underline underline-offset-2"
                >
                  Sign in with your password
                </button>
              )}
            </div>
          )}

          {/* /sign-in (no intent): the inverse case — don't let a typo or a
              genuinely new visitor sit here guessing why "Sign in" won't work. */}
          {intent === null && emailStatus === "unregistered" && (
            <div className="mb-4 rounded-xl border border-[#0A0A0A]/10 bg-[#0A0A0A]/5 px-4 py-3 text-xs text-[#0A0A0A]/70">
              We couldn&apos;t find an account with that email.{" "}
              <Link
                to="/no-account"
                className="font-medium text-[#2151F5] underline underline-offset-2"
              >
                Create one instead
              </Link>
            </div>
          )}

          {mode === "password" ? (
            <form onSubmit={handlePasswordSignIn} className="space-y-3">
              <label htmlFor="auth-email" className="sr-only">
                Email address
              </label>
              <input
                id="auth-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.com"
                className="w-full rounded-full border border-[#0A0A0A]/25 bg-transparent px-5 py-3.5 text-sm placeholder:text-[#0A0A0A]/40 focus:outline-none focus:border-[#2151F5] transition-colors"
              />
              <label htmlFor="auth-password" className="sr-only">
                Password
              </label>
              <input
                id="auth-password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full rounded-full border border-[#0A0A0A]/25 bg-transparent px-5 py-3.5 text-sm placeholder:text-[#0A0A0A]/40 focus:outline-none focus:border-[#2151F5] transition-colors"
              />
              <button
                type="submit"
                disabled={busy === "password"}
                className="w-full rounded-full bg-[#2151F5] text-white py-3.5 text-sm font-medium uppercase tracking-widest hover:bg-[#2151F5]/90 hover:scale-[1.01] transition-all duration-300 disabled:opacity-60"
              >
                {busy === "password" ? <Spinner className="align-middle" /> : "Sign in"}
              </button>
              <FormError>{error}</FormError>
              <button
                type="button"
                onClick={
                  intent === null
                    ? switchToCode
                    : () => {
                        // Reached via the "you already have an account"
                        // banner, not a forgotten password — no reset flag,
                        // so verifying the code lands straight on their
                        // profile (or /switching-roles) via the normal
                        // resolvePostAuthRedirect path, same as it would for
                        // any other returning user.
                        setMode("code");
                        setError(null);
                        setNotice(null);
                      }
                }
                className="w-full text-[11px] uppercase tracking-widest text-[#0A0A0A]/60 hover:text-[#0A0A0A] transition-colors pt-2"
              >
                {intent === null
                  ? "Forgot password? Email me a code"
                  : "Sign in with a code instead"}
              </button>
            </form>
          ) : !sent ? (
            <form onSubmit={handleSend} className="space-y-3">
              <label htmlFor="auth-email" className="sr-only">
                Email address
              </label>
              <input
                id="auth-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.com"
                className="w-full rounded-full border border-[#0A0A0A]/25 bg-transparent px-5 py-3.5 text-sm placeholder:text-[#0A0A0A]/40 focus:outline-none focus:border-[#2151F5] transition-colors"
              />
              <button
                type="submit"
                disabled={busy === "send"}
                className="w-full rounded-full bg-[#2151F5] text-white py-3.5 text-sm font-medium uppercase tracking-widest hover:bg-[#2151F5]/90 hover:scale-[1.01] transition-all duration-300 disabled:opacity-60"
              >
                {busy === "send" ? <Spinner className="align-middle" /> : "Email me a code"}
              </button>
              <FormError>{error}</FormError>
              {/* Hidden only on the onboarding pages once the registered-email
                  banner above is already showing its own "Sign in with your
                  password" action — no need to offer the same switch twice.
                  /sign-in never renders that banner for a registered email
                  (there's nothing to warn about — that's the expected case
                  there), so this stays the only way there to reach password
                  mode from the code view and must not be hidden. */}
              {!(intent !== null && emailStatus === "registered") && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("password");
                    setError(null);
                    setNotice(null);
                  }}
                  className="w-full text-[11px] uppercase tracking-widest text-[#0A0A0A]/60 hover:text-[#0A0A0A] transition-colors pt-2"
                >
                  Already have a password? Sign in
                </button>
              )}
            </form>
          ) : (
            <div className="text-center space-y-4">
              <div className="rounded-2xl border border-[#0A0A0A]/15 px-6 py-8">
                <p className="font-serif text-2xl">Check your email</p>
                <p className="mt-2 text-sm text-[#0A0A0A]/70">
                  We sent a 6-digit code to <span className="text-[#0A0A0A]">{email}</span>. It
                  expires in a few minutes.
                </p>
              </div>

              <form onSubmit={handleVerify} className="space-y-3">
                <CodeInput value={code} onChange={setCode} disabled={busy === "verify"} />
                <button
                  type="submit"
                  disabled={busy === "verify" || code.length < 6}
                  className="w-full rounded-full bg-[#2151F5] text-white py-3.5 text-sm font-medium uppercase tracking-widest hover:bg-[#2151F5]/90 hover:scale-[1.01] transition-all duration-300 disabled:opacity-60"
                >
                  {busy === "verify" ? <Spinner className="align-middle" /> : "Verify code"}
                </button>
              </form>

              <FormError>{error}</FormError>

              <div className="text-sm text-[#0A0A0A]/70">
                {countdown > 0 ? (
                  <span>
                    Resend code in{" "}
                    <span className="text-[#0A0A0A] tabular-nums">
                      {mm}:{ss}
                    </span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={busy === "send"}
                    className="text-[#2151F5] uppercase tracking-widest text-[11px] font-medium hover:underline disabled:opacity-60"
                  >
                    Resend code
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSent(false);
                  setEmail("");
                  setCode("");
                  setError(null);
                }}
                className="text-[11px] uppercase tracking-widest text-[#0A0A0A]/60 hover:text-[#0A0A0A] transition-colors"
              >
                Use a different email
              </button>
            </div>
          )}

          {intent === null && (
            <Link
              to="/no-account"
              className="mt-8 block text-center text-[11px] uppercase tracking-widest text-[#0A0A0A]/60 hover:text-[#0A0A0A] transition-colors"
            >
              Create a new account
            </Link>
          )}

          {emailFirst && (
            <>
              {dividerWith("or continue with Google")}
              {googleButton}
            </>
          )}

          <p className="mt-6 text-center text-[11px] text-[#0A0A0A]/50 leading-relaxed">
            By continuing, you agree to our{" "}
            <Link to="/terms" className="underline hover:text-[#2151F5]">
              Terms
            </Link>{" "}
            and{" "}
            <Link to="/privacy" className="underline hover:text-[#2151F5]">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
