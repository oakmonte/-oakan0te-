import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/integrations/my-supabase/client";

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

    const finishSignIn = async (userId: string, email: string | undefined, usernameFromMetadata?: string) => {
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .maybeSingle();

      if (existingProfile) {
        navigate({ to: "/", replace: true });
        return;
      }

      if (usernameFromMetadata) {
        const { error: insertError } = await supabase.from("profiles").insert({
          id: userId,
          personal_username: usernameFromMetadata,
          personal_email: email,
        });

        if (insertError) {
          console.error(insertError);
          setError("We couldn't finish setting up your account.");
          return;
        }

        navigate({ to: "/name-your-store", replace: true });
      } else {
        navigate({ to: "/choose-username", replace: true });
      }
    };

    (async () => {
      // Give supabase-js a tick to hydrate session from URL
      for (let i = 0; i < 30; i++) {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        if (data.session) {
          const { user } = data.session;
          await finishSignIn(user.id, user.email, user.user_metadata?.username as string | undefined);
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