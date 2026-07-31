import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { getProfileUsernameFromUser } from "@/lib/auth";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({ meta: [{ title: "Signing you in — Oakmonte" }] }),
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const hashError = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("error_description");
    const qsError = new URLSearchParams(window.location.search).get("error_description");
    if (hashError || qsError) {
      setError(hashError || qsError);
      return;
    }

    const finishSignIn = async (userId: string) => {
      const { data } = await supabase.auth.getUser();
      const username = getProfileUsernameFromUser(data.user);
      const nextUsername = username ?? userId.slice(0, 8);

      navigate({ to: "/profile/$username", params: { username: nextUsername }, replace: true });
    };

    (async () => {
      // Give supabase-js a tick to hydrate session from URL
      for (let i = 0; i < 30; i++) {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        if (data.session) {
          await finishSignIn(data.session.user.id);
          return;
        }
        await new Promise((r) => setTimeout(r, 100));
      }
      if (!cancelled) setError("Could not complete sign-in. Please try again.");
    })();

    return () => { cancelled = true; };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        {error ? (
          <>
            <h1 className="font-serif text-3xl mb-3">Sign-in failed</h1>
            <p className="text-sm text-brand-text/70 mb-6">{error}</p>
            <a href="/set-up-store" className="text-[11px] uppercase tracking-widest text-brand-accent hover:underline">Try again</a>
          </>
        ) : (
          <>
            <h1 className="font-serif text-3xl mb-3">Signing you in…</h1>
            <p className="text-sm text-brand-text/70">One moment.</p>
          </>
        )}
      </div>
    </div>
  );
}