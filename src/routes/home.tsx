import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { FullPreview, PublicStorefront } from "@/components/store-themes/full-previews";
import { viewOnly } from "@/components/store-themes/view-only";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { useSession } from "@/hooks/use-session";
import { useActiveStore } from "@/hooks/use-own-store";
import { useStoreSetupStatus } from "@/hooks/use-store-setup-status";
import { useGoRoot } from "@/hooks/use-back";

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

  // The same test /store uses to swap its setup checklist for the dashboard:
  // until then there's no finished storefront to preview, so this sends the
  // seller back to the checklist. A failed check doesn't hold the preview
  // hostage -- it shows the store.
  const setup = useStoreSetupStatus(store?.id ?? null);
  const setUp = setup.failed || setup.complete || !!setup.onboardedAt;
  const goRoot = useGoRoot();

  const loading =
    sessionLoading || (!!user && storeLoading) || (!!store && setup.loading && !setup.failed);

  return (
    <div
      className="min-h-screen bg-chat-bg text-chat-text"
      style={{ fontFamily: "'SF Pro', system-ui, sans-serif" }}
    >
      {loading ? null : store && !setUp ? (
        <SampleStorefront
          brandName={store.brand_name || "Your store"}
          title="Your store isn't ready yet"
          action="Set up store"
          onAction={() => goRoot({ to: "/store" })}
        />
      ) : store ? (
        // The storefront brings its own bottom bar (StorefrontNav, with Back
        // and Open website in preview mode), so no app nav here.
        <PublicStorefront storeId={store.id} paintChrome preview />
      ) : (
        <SampleStorefront
          brandName="Your store"
          title={user ? "Your store shows up here" : "Sign in to see your store"}
          action={user ? "Set up your store" : "Sign in"}
          to={user ? "/store" : "/sign-in"}
        />
      )}

      {!loading && (!store || !setUp) && <BottomNav active="website" ownUsername={ownUsername} />}
    </div>
  );
}

/** Before there's a finished store to show (signed out, or setup not done):
 *  a real storefront theme filled with sample content, so the tab shows what
 *  it will become instead of an empty black page -- and says plainly, at the
 *  top, that this is a preview and not the seller's store.
 *
 *  Scrolls like the real thing; taps inside are swallowed (capture phase), so
 *  nothing in the sample (cart, product pages) pretends to work. */
function SampleStorefront({
  brandName,
  title,
  action,
  to,
  onAction,
}: {
  brandName: string;
  title: string;
  action: string;
  to?: "/store" | "/sign-in";
  onAction?: () => void;
}) {
  const editing = useMemo(() => viewOnly("cards"), []);
  const buttonClass =
    "flex h-10 shrink-0 items-center rounded-full bg-chat-text px-5 text-[14px] font-semibold text-chat-inverse active:scale-[0.98]";
  return (
    <div className="relative min-h-screen pb-28">
      <div className="sticky top-0 z-30 px-3 pt-[calc(env(safe-area-inset-top)+10px)] pb-2">
        <div className="mx-auto flex max-w-[560px] items-center gap-3 rounded-2xl bg-black/75 px-4 py-3 shadow-lg ring-1 ring-white/15 backdrop-blur-md">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/60">
              Preview · Sample store
            </p>
            <p className="mt-0.5 text-[14px] font-semibold leading-snug text-white">{title}</p>
          </div>
          {to ? (
            <Link to={to} className={buttonClass}>
              {action}
            </Link>
          ) : (
            <button type="button" onClick={onAction} className={buttonClass}>
              {action}
            </button>
          )}
        </div>
      </div>
      <div
        className="@container -mt-[76px] overflow-x-clip"
        aria-label="Sample storefront"
        onClickCapture={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <FullPreview themeId="motion" storeId={null} brandName={brandName} editing={editing} />
      </div>
    </div>
  );
}
