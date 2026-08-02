import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/integrations/my-supabase/client";

export const Route = createFileRoute("/no-account")({
  head: () => ({ meta: [{ title: "Welcome to Oakmonte" }] }),
  component: NoAccountPage,
});

function NoAccountPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (!data.session) {
        navigate({ to: "/", replace: true });
        return;
      }
      setChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (checking) {
    return (
      <div className="min-h-screen bg-brand-bg text-brand-text flex items-center justify-center">
        <span className="text-sm text-brand-text/50">One moment…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text flex flex-col">
      <header className="px-6 sm:px-10 py-6 flex items-center justify-between">
        <Link to="/" className="flex items-center">
          <img src="/favicon.png" alt="Oakmonte" className="h-9 w-auto" />
        </Link>
        <Link to="/" className="text-[11px] uppercase tracking-widest hover:text-brand-accent transition-colors">← Back</Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm text-center">
          <h1 className="font-serif text-3xl sm:text-4xl leading-tight mb-3">
            You don't seem to have an account with us
          </h1>
          <p className="text-sm text-brand-text/70 mb-10">
            Tell us what brings you to Oakmonte, and we'll get you set up.
          </p>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => navigate({ to: "/set-up-store" })}
              className="w-full text-center px-6 py-4 bg-brand-text text-brand-bg text-[11px] uppercase tracking-widest font-bold hover:bg-brand-accent transition-colors duration-300"
            >
              Set Up A Store
            </button>
            <button
              type="button"
              onClick={() => navigate({ to: "/become-a-creator" })}
              className="w-full text-center px-6 py-4 bg-brand-text text-brand-bg text-[11px] uppercase tracking-widest font-bold hover:bg-brand-accent transition-colors duration-300"
            >
              Become a Creator
            </button>
            <button
              type="button"
              onClick={() => navigate({ to: "/become-a-curator" })}
              className="w-full text-center px-6 py-4 bg-brand-bg border border-brand-text text-[11px] uppercase tracking-widest font-bold hover:border-brand-accent hover:text-brand-accent transition-colors duration-300"
            >
              Define Your Wardrobe
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}