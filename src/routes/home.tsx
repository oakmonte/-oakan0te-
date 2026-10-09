import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { PublicStorefront } from "@/components/store-themes/full-previews";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { useSession } from "@/hooks/use-session";
import { useActiveStore } from "@/hooks/use-own-store";

export const Route = createFileRoute("/home")({
  head: () => ({ meta: [{ title: "Oakmonte" }] }),
  component: HomePage,
});

// Sellers-only pivot: Home is the seller's own storefront, live. It renders
// the same PublicStorefront the public site (/shop/$storeUsername)
// does, from the same saved theme, so any change to the store shows up here
// and on the website at once -- there's no separate preview copy to drift.
function HomePage() {
  const { user, loading: sessionLoading } = useSession();
  const { store, loading: storeLoading } = useActiveStore();
  const [ownUsername, setOwnUsername] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("personal_username")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setOwnUsername(data.personal_username);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const loading = sessionLoading || (!!user && storeLoading);

  return (
    <div
      className="min-h-screen bg-chat-bg text-chat-text"
      style={{ fontFamily: "'SF Pro', system-ui, sans-serif" }}
    >
      {loading ? null : store ? (
        // The storefront brings its own bottom bar (StorefrontNav, with Back
        // and Open website in preview mode), so no app nav here.
        <PublicStorefront storeId={store.id} paintChrome preview />
      ) : (
        <div className="flex min-h-screen flex-col items-center justify-center px-10 pb-28 text-center">
          <p className="text-[20px] font-bold">
            {user ? "Your store shows up here" : "Sign in to see your store"}
          </p>
          <p className="mt-2 max-w-[290px] text-[14.5px] leading-relaxed text-chat-muted">
            {user
              ? "Set up your store and Home becomes a live view of your website."
              : "Home is a live view of your store's website."}
          </p>
          <Link
            to={user ? "/store" : "/sign-in"}
            className="mt-6 flex h-12 items-center rounded-full bg-chat-text px-8 text-[16px] font-semibold text-chat-inverse active:scale-[0.98]"
          >
            {user ? "Set up your store" : "Sign in"}
          </Link>
        </div>
      )}

      {!store && <BottomNav active="website" ownUsername={ownUsername} />}
    </div>
  );
}
