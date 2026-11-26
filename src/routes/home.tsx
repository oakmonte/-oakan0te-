import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { FullPreview, PublicStorefront } from "@/components/store-themes/full-previews";
import { PHONE_H, PHONE_W, PhonePreview } from "@/components/store-themes/SamplePhone";
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
 *  what the tab will become, in a frame, with a plain line above it saying
 *  it's a preview and what to do next (sign in, or finish setting up).
 *
 *  Nothing new here: Phone is the showcase's phone (the store / feed /
 *  messages bar every website carries, the page scrolling down into the
 *  products), and Desktop is the theme editor's shrunk laptop view -- a
 *  storefront laid out at a laptop width, then scaled down to fit. */
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
  const [vw, setVw] = useState(0);
  const [vh, setVh] = useState(0);
  const [device, setDevice] = useState<"phone" | "desktop" | null>(null);
  useEffect(() => {
    const measure = () => {
      setVw(window.innerWidth);
      setVh(window.innerHeight);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  // A laptop opens on the laptop view; anything narrower on the phone.
  const shown = device ?? (vw >= 1024 && vw > vh ? "desktop" : "phone");

  // The heading, the switch and the app's bottom bar take about CHROME_H;
  // the frame gets the rest, and never more than the width allows.
  const roomW = vw - 32;
  const roomH = vh - CHROME_H;
  const phoneScale = Math.max(0.42, Math.min(0.9, roomW / PHONE_W, roomH / PHONE_H));
  const deskScale = Math.min(1, roomW / DESK_W, Math.max(roomH, 220) / DESK_H);

  const buttonClass =
    "mx-auto mt-4 flex h-11 w-full max-w-[280px] items-center justify-center rounded-full bg-chat-text text-[15px] font-semibold text-chat-inverse active:scale-[0.98]";
  return (
    <div className="flex min-h-screen flex-col items-center overflow-x-clip px-4 pb-32 pt-[calc(env(safe-area-inset-top)+20px)]">
      <div className="max-w-[420px] text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-chat-text/55">
          Preview · Sample store
        </p>
        <h1 className="mt-1.5 text-[22px] font-semibold leading-tight tracking-tight">{title}</h1>
        <p className="mt-1.5 text-[14px] leading-snug text-chat-text/60">
          This is how your website will look to buyers. It isn&apos;t your store yet.
        </p>
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

      <div
        role="tablist"
        aria-label="Preview size"
        className="mt-5 flex rounded-full bg-chat-text/10 p-1 text-[13px] font-semibold"
      >
        {(["phone", "desktop"] as const).map((d) => (
          <button
            key={d}
            type="button"
            role="tab"
            aria-selected={shown === d}
            onClick={() => setDevice(d)}
            className={`h-8 rounded-full px-4 capitalize transition-colors ${
              shown === d ? "bg-chat-text text-chat-inverse" : "text-chat-text/70"
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      {vw > 0 && (
        <div className="mt-5" aria-label="Sample storefront">
          {shown === "phone" ? (
            // The showcase phone animates itself and takes no taps.
            <PhonePreview
              themeId="motion"
              brandName={brandName}
              scale={phoneScale}
              motion="cards"
              hero="cards"
              drift={false}
            />
          ) : (
            <DesktopSample brandName={brandName} scale={deskScale} />
          )}
        </div>
      )}
    </div>
  );
}

/** Height the heading, the Phone/Desktop switch and the app's bottom bar take. */
const CHROME_H = 345;
/** The laptop view's screen, before it's scaled down: the theme editor's
 *  desktop width, at a laptop's 16:10. */
const DESK_W = 1280;
const DESK_H = 800;

/** A storefront at laptop width in a laptop-ish frame, scaled to fit: a box
 *  the scaled size holds the place, the screen inside is drawn full size and
 *  scaled from its top-left corner (CSS zoom draws differently in Safari).
 *  It scrolls like the real page; taps are swallowed, so nothing in the
 *  sample (cart, product pages) pretends to work. */
function DesktopSample({ brandName, scale }: { brandName: string; scale: number }) {
  const editing = useMemo(() => viewOnly("cards"), []);
  return (
    <div className="flex flex-col items-center">
      <div style={{ width: DESK_W * scale, height: DESK_H * scale }}>
        <div
          className="overflow-hidden rounded-[18px] border-[10px] border-neutral-900 bg-neutral-900 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)]"
          style={{
            width: DESK_W,
            height: DESK_H,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          <div
            className="no-scrollbar h-full overflow-y-auto bg-white"
            onClickCapture={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <div className="@container overflow-x-clip">
              <FullPreview
                themeId="motion"
                storeId={null}
                brandName={brandName}
                editing={editing}
              />
            </div>
          </div>
        </div>
      </div>
      {/* The laptop's base. */}
      <div
        className="rounded-b-[10px] bg-neutral-700"
        style={{ width: DESK_W * scale * 1.12, height: Math.max(6, 16 * scale) }}
      />
    </div>
  );
}
