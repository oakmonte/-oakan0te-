import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { GLASS_RIM, glassLens, glassLight } from "@/lib/liquid-glass";
import { useBack } from "@/hooks/use-back";
import shopIcon from "@/assets/Store.svg";
import homeIcon from "@/assets/Home.svg";
import messagesIcon from "@/assets/messages.svg";

type Tab = "shop" | "home" | "messages";

/** The storefront's own bottom bar: Shop, Home, Messages in a glass pill.
 *  Rendered by PublicStorefront, so the seller's preview (Home tab) and the
 *  real website get the same bar. The preview adds a round back button on the
 *  left and an Open website button on the right; the website doesn't need
 *  either -- it is the website. */
export function StorefrontNav({
  storeId,
  rootRef,
  preview,
}: {
  storeId: string;
  /** The storefront's outer element, for Home's scroll-to-top. */
  rootRef: React.RefObject<HTMLDivElement | null>;
  preview: boolean;
}) {
  const navigate = useNavigate();
  const { back } = useBack({ to: "/store" });
  const [active, setActive] = useState<Tab>("home");
  const [ids, setIds] = useState<{ storeUsername: string; ownerUsername: string | null } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data: store } = await supabase
        .from("stores")
        .select("store_username, owner_id")
        .eq("id", storeId)
        .maybeSingle();
      if (!store || cancelled) return;
      const { data: owner } = await supabase
        .from("profiles")
        .select("personal_username")
        .eq("id", store.owner_id)
        .maybeSingle();
      if (!cancelled) {
        setIds({
          storeUsername: store.store_username,
          ownerUsername: owner?.personal_username ?? null,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  function press(tab: Tab) {
    setActive(tab);
    if (tab === "home") {
      rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (tab === "shop") {
      // The theme's Products (or Collections) heading; see full-preview-blocks.
      const section =
        rootRef.current?.querySelector('[data-storefront-section="products"]') ??
        rootRef.current?.querySelector('[data-storefront-section="collections"]');
      section?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      void navigate({
        to: "/messages",
        search: ids?.ownerUsername ? { to: ids.ownerUsername } : {},
      });
    }
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "shop", label: "Shop", icon: shopIcon },
    { key: "home", label: "Home", icon: homeIcon },
    { key: "messages", label: "Message the store", icon: messagesIcon },
  ];

  const round =
    "pointer-events-auto grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full text-black active:scale-[0.94] transition-transform duration-150";

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 px-4"
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
            onClick={() => press(key)}
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

      {preview && ids ? (
        <Link
          to="/store-profile/$storeUsername"
          params={{ storeUsername: ids.storeUsername }}
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
  );
}
