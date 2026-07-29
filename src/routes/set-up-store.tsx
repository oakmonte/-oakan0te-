import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { signInWithGoogle, sendMagicLink } from "@/lib/auth";
import { AppleIcon, GoogleIcon } from "@/components/auth-icons";
import { supabase } from "@/lib/integrations/my-supabase/client";

export const Route = createFileRoute("/set-up-store")({
  head: () => ({
    meta: [
      { title: "Set up a Store — Oakmonte" },
      { name: "description", content: "Create your Oakmonte seller account to launch a content-driven storefront." },
      { property: "og:title", content: "Set up a Store — Oakmonte" },
      { property: "og:description", content: "Create your Oakmonte seller account to launch a content-driven storefront." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SetUpStorePage,
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

function SetUpStorePage() {
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
    sessionStorage.setItem("oakmonte_intent", "seller");
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
    sessionStorage.setItem("oakmonte_intent", "seller");
    const { error } = await sendMagicLink(email);
    if (error) { setError(error.message); return; }
    setCountdown(30);
  };

  const handleGoogle = async () => {
    sessionStorage.setItem("oakmonte_intent", "seller");
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

    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    navigate({ to: existingProfile ? "/" : "/choose-username", replace: true });
  };

  const mm = String(Math.floor(countdown / 60)).padStart(2, "0");
  const ss = String(countdown % 60).padStart(2, "0");

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text flex flex-col">
      <header className="px-6 sm:px-10 py-6 flex items-center justify-between">
        <Link to="/" className="font-display text-2xl tracking-wider">OAKMONTE</Link>
        <Link to="/" className="text-[11px] uppercase tracking-widest hover:text-brand-accent transition-colors">← Back</Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm">
          <div className="text-center mb-10">
            <h1 className="font-serif text-4xl sm:text-5xl leading-tight">Set up a Store</h1>
            <p className="mt-3 text-sm text-brand-text/70">Join Oakmonte as a vetted seller.</p>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleGoogle}
              disabled={loading === "google"}
              className="w-full flex items-center justify-center gap-3 bg-brand-text text-brand-bg rounded-full py-3.5 text-sm font-medium hover:bg-brand-text/85 hover:scale-[1.01] transition-all duration-300 disabled:opacity-60"
            >
              <GoogleIcon />
              {loading === "google" ? "Redirecting…" : "Continue with Google"}
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
                {loading === "email" ? "Sending…" : "Send"}
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
                  {loading === "verify" ? "Verifying…" : "Verify code"}
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