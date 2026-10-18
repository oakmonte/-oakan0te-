import { useContext, useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ChevronLeft, ExternalLink, Search, Share2, ShoppingBag } from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { GLASS_RIM, glassLens, glassLight } from "@/lib/liquid-glass";
import { useBack } from "@/hooks/use-back";
import shopIcon from "@/assets/Store.svg";
import homeIcon from "@/assets/Home.svg";
import messagesIcon from "@/assets/messages.svg";
import { SALES_LOCKED, SHARING_LOCKED, WEBSITE_VISITS_LOCKED } from "@/lib/launch-locks";
import { useLockedBanner } from "@/components/LockedBanner";
import { StorefrontSearchContext } from "./live-storefront";
import { isDark } from "./theme-spec";

export type StorefrontTab = "shop" | "home" | "messages";

/** The storefront's own navigation. On a phone: Shop, Home, Messages in a glass
 *  pill along the bottom. From `md` up (a laptop or tablet): a top bar with the
 *  brand, the same three tabs, and search / cart / share. Rendered by
 *  PublicStorefront, so the seller's preview (Home tab) and the real website
 *  get the same navigation. The preview adds a back button and an Open website
 *  button; the website doesn't need either -- it is the website. */
export function StorefrontNav({
  storeId,
  active,
  overPage = false,
  onSelect,
  preview,
  brandName,
  logo,
  barBg,
}: {
  storeId: string;
  /** Shop is the storefront page, Home the store's content feed, Messages
   *  the one contact a buyer needs (StorefrontMessages). */
  active: StorefrontTab;
  /** A product or collection page is open: the bar sits above it (those
   *  pages are z-80/90; dialogs and notices over them are higher still). */
  overPage?: boolean;
  onSelect: (tab: StorefrontTab) => void;
  preview: boolean;
  /** The desktop bar's brand mark, and the colour it sits on (the page's own
   *  ground, so the bar reads as part of the page). */
  brandName: string;
  logo: string | null;
  barBg: string;
}) {
  const { back } = useBack({ to: "/store" });
  const navigate = useNavigate();
  const search = useContext(StorefrontSearchContext);
  const [searchOpen, setSearchOpen] = useState(false);
  const [storeUsername, setStoreUsername] = useState<string | null>(null);
  const { banner: lockedBanner, showLocked } = useLockedBanner();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data: store } = await supabase
        .from("stores")
        .select("store_username")
        .eq("id", storeId)
        .maybeSingle();
      if (store && !cancelled) setStoreUsername(store.store_username);
    })();
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  const tabs: { key: StorefrontTab; label: string; icon: string }[] = [
    { key: "shop", label: "Shop", icon: shopIcon },
    { key: "home", label: "Home", icon: homeIcon },
    { key: "messages", label: "Messages", icon: messagesIcon },
  ];

  const round =
    "pointer-events-auto grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full text-black active:scale-[0.94] transition-transform duration-150";

  // Desktop top bar colours come from the page ground, the same derivation
  // StoreFooter uses, so it reads on light and dark themes alike.
  const dark = isDark(barBg);
  const ink = dark ? "#ffffff" : "#111111";
  const muted = dark ? "rgba(255,255,255,0.62)" : "rgba(17,17,17,0.58)";
  const line = dark ? "rgba(255,255,255,0.12)" : "rgba(17,17,17,0.1)";
  const iconBtn =
    "grid h-10 w-10 place-items-center rounded-full transition-opacity hover:opacity-70";

  return (
    <>
      {/* Fixed rather than in the flow so one component serves every tab;
          PublicStorefront leaves a matching 64px spacer under it. */}
      <header
        className="fixed inset-x-0 top-0 z-40 hidden border-b backdrop-blur-md md:block"
        style={{ background: barBg, borderColor: line, color: ink }}
      >
        <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-6 px-8">
          {preview && (
            <button
              type="button"
              onClick={back}
              aria-label="Back"
              className={`${iconBtn} -ml-2`}
              style={{ color: muted }}
            >
              <ChevronLeft size={22} strokeWidth={2.2} />
            </button>
          )}
          <div className="flex min-w-0 items-center gap-3">
            {logo ? (
              <img
                src={logo}
                alt=""
                className="h-9 w-auto max-w-[120px] rounded-md object-contain"
              />
            ) : (
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border text-[16px] font-bold"
                style={{ borderColor: line }}
              >
                {brandName.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="truncate text-[16px] font-bold">{brandName}</span>
          </div>

          <nav aria-label="Store" className="mx-auto flex items-center gap-8">
            {tabs.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => onSelect(key)}
                aria-current={active === key ? "page" : undefined}
                className="border-b-2 py-1.5 text-[14px] font-medium tracking-[0.04em] transition-colors"
                style={{
                  borderColor: active === key ? ink : "transparent",
                  color: active === key ? ink : muted,
                }}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-1" style={{ color: muted }}>
            {searchOpen && (
              <div
                className="mr-1 flex h-10 w-[260px] items-center gap-2 rounded-full border px-3.5"
                style={{ borderColor: line, color: ink }}
              >
                <Search size={16} strokeWidth={2} style={{ color: muted }} />
                <input
                  autoFocus
                  value={search?.query ?? ""}
                  onChange={(e) => search?.setQuery(e.target.value)}
                  placeholder="Search this store"
                  aria-label="Search this store"
                  className="min-w-0 flex-1 bg-transparent text-[14px] outline-none"
                />
              </div>
            )}
            <button
              type="button"
              aria-label="Search products"
              onClick={() => {
                if (active !== "shop") onSelect("shop");
                setSearchOpen((v) => !v);
                if (searchOpen) search?.setQuery("");
              }}
              className={iconBtn}
            >
              <Search size={19} strokeWidth={1.8} fill={searchOpen ? "currentColor" : "none"} />
            </button>
            <button
              type="button"
              aria-label="Cart"
              onClick={() =>
                SALES_LOCKED ? showLocked("Carts unavailable") : void navigate({ to: "/cart" })
              }
              className={iconBtn}
            >
              <ShoppingBag size={19} strokeWidth={1.8} />
            </button>
            <button
              type="button"
              aria-label="Share"
              onClick={() => {
                if (SHARING_LOCKED) return showLocked("Sharing unavailable");
                void navigator.share?.({ url: window.location.href }).catch(() => {});
              }}
              className={iconBtn}
            >
              <Share2 size={19} strokeWidth={1.8} />
            </button>
            {preview && WEBSITE_VISITS_LOCKED ? (
              <button
                type="button"
                onClick={() => showLocked("Website visits are not available for now")}
                aria-label="Open website"
                className={iconBtn}
              >
                <ExternalLink size={19} strokeWidth={1.8} />
              </button>
            ) : preview && storeUsername ? (
              <Link
                to="/shop/$storeUsername"
                params={{ storeUsername }}
                aria-label="Open website"
                className={iconBtn}
              >
                <ExternalLink size={19} strokeWidth={1.8} />
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      <nav
        className={`pointer-events-none fixed inset-x-0 bottom-0 flex items-center justify-between gap-3 px-4 md:hidden ${overPage ? "z-[91]" : "z-40"}`}
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
      >
        {preview ? (
          <button
            type="button"
            onClick={back}
            aria-label="Back"
            className={`${GLASS_RIM} ${round}`}
            style={glassLight}
          >
            <ChevronLeft size={26} strokeWidth={2.4} />
          </button>
        ) : (
          <span className="w-[52px]" />
        )}

        <div
          className={`${GLASS_RIM} pointer-events-auto relative flex h-[60px] items-center rounded-full p-[5px]`}
          style={glassLight}
        >
          {tabs.map(({ key, label, icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              aria-label={label}
              aria-current={active === key ? "page" : undefined}
              className="relative grid h-full w-[62px] place-items-center"
            >
              {active === key && (
                <motion.span
                  layoutId={`storefront-nav-lens-${storeId}`}
                  className={`${GLASS_RIM} absolute inset-0 rounded-full`}
                  style={glassLens}
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <motion.img
                src={icon}
                alt=""
                animate={{ scale: active === key ? 1.12 : 1, opacity: active === key ? 1 : 0.55 }}
                whileTap={{ scale: 0.86 }}
                transition={{ type: "spring", stiffness: 320, damping: 20, mass: 0.6 }}
                className="relative"
                style={{ width: 25, height: 25, filter: "brightness(0)" }}
              />
            </button>
          ))}
        </div>

        {preview && WEBSITE_VISITS_LOCKED ? (
          <button
            type="button"
            onClick={() => showLocked("Website visits are not available for now")}
            aria-label="Open website"
            className={`${GLASS_RIM} ${round}`}
            style={glassLight}
          >
            <ExternalLink size={22} strokeWidth={2.3} />
          </button>
        ) : preview && storeUsername ? (
          <Link
            to="/shop/$storeUsername"
            params={{ storeUsername }}
            aria-label="Open website"
            className={`${GLASS_RIM} ${round}`}
            style={glassLight}
          >
            <ExternalLink size={22} strokeWidth={2.3} />
          </Link>
        ) : (
          <span className="w-[52px]" />
        )}
      </nav>
      {lockedBanner}
    </>
  );
}
