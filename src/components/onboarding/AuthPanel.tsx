import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  resolvePostAuthRedirect,
  sendEmailCode,
  signInWithGoogle,
  signInWithPassword,
  verifyEmailCode,
} from "@/lib/auth";
import { setIntent, setPasswordResetPending, type Intent } from "@/lib/onboarding-state";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { GoogleIcon } from "@/components/auth-icons";
import { Spinner } from "@/components/spinner";
import { CodeInput } from "@/components/onboarding/CodeInput";
import { FormError } from "@/components/onboarding/OnboardingShell";

const RESEND_SECONDS = 30;

type Mode = "code" | "password";
type Busy = "google" | "send" | "verify" | "password" | null;

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

  const finish = async (userId: string) => {
    const redirect = await resolvePostAuthRedirect(userId, intent);
    navigate({ ...redirect, replace: true });
  };

  const handleGoogle = async () => {
    if (intent) setIntent(intent);
    setError(null);
    setBusy("google");
    const { error: oauthError } = await signInWithGoogle();
    if (oauthError) {
      setError(oauthError.message);
      setBusy(null);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    if (intent) setIntent(intent);
    setError(null);
    setNotice(null);
    setBusy("send");
    const { error: sendError } = await sendEmailCode(email.trim(), { createUser: intent !== null });
    setBusy(null);
    if (sendError) {
      // Deliberately vague on /sign-in: naming the reason would confirm whether
      // an address is registered. The code screen is shown either way, so a
      // guesser learns nothing from the response.
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
    setBusy("send");
    const { error: sendError } = await sendEmailCode(email.trim(), { createUser: intent !== null });
    setBusy(null);
    if (sendError) {
      // Same suppression as handleSend: on /sign-in, "Signups not allowed for
      // otp" would confirm the address is unregistered, which is exactly the
      // enumeration oracle the send path is careful to avoid.
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

  if (checkingSession) {
    return (
      <div className="min-h-dvh bg-white text-[#0A0A0A] flex items-center justify-center">
        <span className="text-sm text-[#0A0A0A]/50">One moment…</span>
      </div>
    );
  }

  return (
    <div data-onboarding className="min-h-dvh bg-white text-[#0A0A0A] flex flex-col">
      <header className="px-6 sm:px-10 py-6 flex items-center justify-between">
        <Link to="/" className="flex items-center">
          <img src="/favicon.png" alt="Oakmonte" className="h-9 w-auto" />
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

          <div className="flex items-center gap-4 my-8">
            <div className="flex-1 h-px bg-[#0A0A0A]/15" />
            <span className="text-[11px] uppercase tracking-widest text-[#0A0A0A]/50">
              {mode === "password" ? "or sign in with email" : "or continue with email"}
            </span>
            <div className="flex-1 h-px bg-[#0A0A0A]/15" />
          </div>

          {notice && <p className="mb-4 text-xs text-[#0A0A0A]/60 text-center">{notice}</p>}

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
                onClick={switchToCode}
                className="w-full text-[11px] uppercase tracking-widest text-[#0A0A0A]/60 hover:text-[#0A0A0A] transition-colors pt-2"
              >
                Forgot password? Email me a code
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
