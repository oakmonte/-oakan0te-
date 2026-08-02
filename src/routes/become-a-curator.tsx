import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { signInWithGoogle, sendMagicLink, resolvePostAuthRedirect } from "@/lib/auth";
import { AppleIcon, GoogleIcon } from "@/components/auth-icons";
import { Spinner } from "@/components/spinner";
import { supabase } from "@/lib/integrations/my-supabase/client";

export const Route = createFileRoute("/become-a-curator")({
  head: () => ({
    meta: [
      { title: "Become a Curator — Oakmonte" },
      { name: "description", content: "Join Oakmonte as a curator and define your wardrobe." },
      { property: "og:title", content: "Become a Curator — Oakmonte" },
      { property: "og:description", content: "Join Oakmonte as a curator and define your wardrobe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BecomeCuratorPage,
});

function CodeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, " ").split("").slice(0, 6);

  const setDigit = (index: number, char: string) => {
    const clean = char.replace(/\D/g, "");
    const next = value.split("");
    next[index] = clean;
    const joined = next.join("").slice(0, 6);
    onChange(joined);
    if (clean && index < 5) inputsRef.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index].trim() && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    onChange(pasted);
    const lastIndex = Math.min(pasted.length, 6) - 1;
    inputsRef.current[lastIndex]?.focus();
  };

  return (
    <div className="flex justify-center gap-2">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            inputsRef.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit.trim()}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          className="w-11 h-13 rounded-xl border border-brand-text/25 bg-transparent text-center text-lg font-medium focus:outline-none focus:border-brand-accent transition-colors"
        />
      ))}
    </div>
  );
}

function BecomeCuratorPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [loading, setLoading] = useState<"google" | "email" | "verify" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");

  useEffect(() => {
    if (!sent) return;
    if (countdown <= 0) return;
    const t = setInterval(() => setCountdown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [sent, countdown]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    sessionStorage.setItem("oakmonte_intent", "curator");
    setError(null);
    setLoading("email");
    const { error } = await sendMagicLink(email);
    setLoading(null);
    if (error) { setError(error.message); return; }
    setSent(true);
    setCountdown(30);
  };

  const handleResend = async () => {
    setError(null);
    setCode("");
    sessionStorage.setItem("oakmonte_intent", "curator");
    const { error } = await sendMagicLink(email);
    if (error) { setError(error.message); return; }
    setCountdown(30);
  };

  const handleGoogle = async () => {
    sessionStorage.setItem("oakmonte_intent", "curator");
    setError(null);
    setLoading("google");
    const { error } = await signInWithGoogle();
    if (error) { setError(error.message); setLoading(null); }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length < 6) return;

    setError(null);
    setLoading("verify");

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: "email",
    });

    setLoading(null);

    if (error) {
      setError("That code didn't work — check it and try again.");
      return;
    }

    const userId = data.session?.user.id;
    if (!userId) {
      setError("Something went wrong. Please try again.");
      return;
    }

    const redirect = await resolvePostAuthRedirect(userId);
    navigate({ ...redirect, replace: true });
  };

  const mm = String(Math.floor(countdown / 60)).padStart(2, "0");
  const ss = String(countdown % 60).padStart(2, "0");

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text flex flex-col">
      <header className="px-6 sm:px-10 py-6 flex items-center justify-between">
        <Link to="/" className="flex items-center">
          <img src="/favicon.png" alt="Oakmonte" className="h-9 w-auto" />
        </Link>
        <Link to="/" className="text-[11px] uppercase tracking-widest hover:text-brand-accent transition-colors">← Back</Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm">
          <div className="text-center mb-10">
            <h1 className="font-serif text-4xl sm:text-5xl leading-tight">Become a Curator</h1>
            <p className="mt-3 text-sm text-brand-text/70">Define your wardrobe and discover pieces that fit you.</p>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleGoogle}
              disabled={loading === "google"}
              className="w-full flex items-center justify-center gap-3 bg-brand-text text-brand-bg rounded-full py-3.5 text-sm font-medium hover:bg-brand-text/85 hover:scale-[1.01] transition-all duration-300 disabled:opacity-60"
            >
              {loading === "google" ? <Spinner /> : <><GoogleIcon />Continue with Google</>}
            </button>
            <button
              type="button"
              disabled
              title="Apple sign-in coming soon"
              className="w-full flex items-center justify-center gap-3 bg-brand-text text-brand-bg rounded-full py-3.5 text-sm font-medium opacity-60 cursor-not-allowed transition-all duration-300"
            >
              <AppleIcon />
              Continue with Apple
            </button>
          </div>

          <div className="flex items-center gap-4 my-8">
            <div className="flex-1 h-px bg-brand-text/15" />
            <span className="text-[11px] uppercase tracking-widest text-brand-text/50">or continue with email</span>
            <div className="flex-1 h-px bg-brand-text/15" />
          </div>

          {!sent ? (
            <form onSubmit={handleSend} className="space-y-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.com"
                className="w-full rounded-full border border-brand-text/25 bg-transparent px-5 py-3.5 text-sm placeholder:text-brand-text/40 focus:outline-none focus:border-brand-accent transition-colors"
              />
              <button
                type="submit"
                disabled={loading === "email"}
                className="w-full rounded-full bg-brand-accent text-brand-bg py-3.5 text-sm font-medium uppercase tracking-widest hover:bg-brand-accent/90 hover:scale-[1.01] transition-all duration-300 disabled:opacity-60"
              >
                {loading === "email" ? <Spinner className="align-middle" /> : "Send"}
              </button>
              {error && <p className="text-xs text-red-600 text-center">{error}</p>}
            </form>
          ) : (
            <div className="text-center space-y-4">
              <div className="rounded-2xl border border-brand-text/15 px-6 py-8">
                <p className="font-serif text-2xl">Check your email</p>
                <p className="mt-2 text-sm text-brand-text/70">
                  We sent a code to <span className="text-brand-text">{email}</span>.
                </p>
              </div>

              <form onSubmit={handleVerifyCode} className="space-y-3">
                <CodeInput value={code} onChange={setCode} />
                <button
                  type="submit"
                  disabled={loading === "verify" || code.trim().length < 6}
                  className="w-full rounded-full bg-brand-accent text-brand-bg py-3.5 text-sm font-medium uppercase tracking-widest hover:bg-brand-accent/90 hover:scale-[1.01] transition-all duration-300 disabled:opacity-60"
                >
                  {loading === "verify" ? <Spinner className="align-middle" /> : "Verify code"}
                </button>
              </form>

              {error && <p className="text-xs text-red-600">{error}</p>}

              <div className="text-sm text-brand-text/70">
                {countdown > 0 ? (
                  <span>Resend code in <span className="text-brand-text tabular-nums">{mm}:{ss}</span></span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    className="text-brand-accent uppercase tracking-widest text-[11px] font-medium hover:underline"
                  >
                    Resend code
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => { setSent(false); setEmail(""); setCode(""); }}
                className="text-[11px] uppercase tracking-widest text-brand-text/60 hover:text-brand-text transition-colors"
              >
                Use a different email
              </button>
            </div>
          )}

          <p className="mt-10 text-center text-[11px] text-brand-text/50 leading-relaxed">
            By continuing, you agree to our{" "}
            <Link to="/terms" className="underline hover:text-brand-accent">Terms</Link>{" "}
            and{" "}
            <Link to="/privacy" className="underline hover:text-brand-accent">Privacy Policy</Link>.
          </p>
        </div>
      </main>
    </div>
  );
}