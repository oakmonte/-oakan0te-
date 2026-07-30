import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppleIcon, GoogleIcon } from "@/components/auth-icons";
import { Spinner } from "@/components/spinner";

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


function BecomeCuratorPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sent) return;
    if (countdown <= 0) return;
    const t = setInterval(() => setCountdown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [sent, countdown]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    // Simulate a brief sending state, then show the mock "Check your email" UI.
    setTimeout(() => {
      setLoading(false);
      setSent(true);
      setCountdown(30);
    }, 600);
  };

  const handleResend = () => {
    setCountdown(30);
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
              className="w-full flex items-center justify-center gap-3 bg-brand-text text-brand-bg rounded-full py-3.5 text-sm font-medium hover:bg-brand-text/85 hover:scale-[1.01] transition-all duration-300"
            >
              <GoogleIcon />
              Continue with Google
            </button>
            <button
              type="button"
              className="w-full flex items-center justify-center gap-3 bg-brand-text text-brand-bg rounded-full py-3.5 text-sm font-medium hover:bg-brand-text/85 hover:scale-[1.01] transition-all duration-300"
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
                disabled={loading}
                className="w-full rounded-full bg-brand-accent text-brand-bg py-3.5 text-sm font-medium uppercase tracking-widest hover:bg-brand-accent/90 hover:scale-[1.01] transition-all duration-300 disabled:opacity-60"
              >
                {loading ? <Spinner className="align-middle" /> : "Send"}
              </button>
            </form>
          ) : (
            <div className="text-center space-y-4">
              <div className="rounded-2xl border border-brand-text/15 px-6 py-8">
                <p className="font-serif text-2xl">Check your email</p>
                <p className="mt-2 text-sm text-brand-text/70">
                  We sent a sign-in link to <span className="text-brand-text">{email}</span>.
                </p>
              </div>
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
                onClick={() => { setSent(false); setEmail(""); }}
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
