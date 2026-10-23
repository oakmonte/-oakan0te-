import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Clapperboard, HandCoins, ShoppingBag, X } from "lucide-react";
import { PostFeed } from "@/components/feed/PostFeed";
import { useBagToast } from "@/components/cart/BagToast";
import { useLockedBanner } from "@/components/LockedBanner";
import { useOverlayHistory } from "@/hooks/use-overlay-history";
import { addProductsToCart, loadFreshProducts } from "@/lib/cart-quote";
import { SALES_LOCKED } from "@/lib/launch-locks";
import { GLASS_RIM, glassDark } from "@/lib/liquid-glass";
import { SalesLockedNotice } from "./SalesLockedNotice";
import type { PreviewTile } from "./storefront-catalog";

const MENU_WIDTH = 232;
// Three 44px rows plus padding; used only to decide whether the menu opens
// above the button or below it.
const MENU_HEIGHT = 152;
const EDGE = 8;

/** The box a product tile's "..." button opens: Add to cart, See related
 *  content, Make offer. One hook for the whole storefront so every tile -- the
 *  grid, a collection page -- opens the same menu and the same follow-ups.
 *
 *  `open(tile, anchor)` shows the menu beside the button; `element` is
 *  everything this feature draws (the menu, the related-content viewer, the
 *  bag toast, the notices) and goes anywhere inside the storefront, because all
 *  of it is portaled to <body>.
 *
 *  - Add to cart: while sales are locked it says so, as the feed's +Cart does.
 *    Otherwise one option goes straight into the bag; several options open the
 *    product page (`onOpenProduct`) so the buyer picks the size.
 *  - See related content: the store's posts that link this product, in a
 *    full-screen viewer.
 *  - Make offer: the same "not available yet" notice the product page shows. */
export function useProductTileMenu(onOpenProduct: (tile: PreviewTile) => void): {
  open: (tile: PreviewTile, anchor: DOMRect) => void;
  element: ReactNode;
} {
  const [menu, setMenu] = useState<{ tile: PreviewTile; anchor: DOMRect } | null>(null);
  const [relatedId, setRelatedId] = useState<string | null>(null);
  const [offerLocked, setOfferLocked] = useState(false);
  const { toast: bagToast, showBagToast } = useBagToast();
  const { banner: lockedBanner, showLocked } = useLockedBanner();

  async function addToCart(tile: PreviewTile) {
    if (SALES_LOCKED) {
      showLocked("Add to cart is unavailable");
      return;
    }
    try {
      const fresh = await loadFreshProducts([tile.id]);
      const product = fresh.get(tile.id);
      if (!product) {
        showBagToast({
          title: "Couldn't add this",
          detail: "It's sold out or no longer listed.",
        });
        return;
      }
      // Several sizes or options: the buyer chooses them on the product page
      // rather than the bag getting a guessed one.
      if (product.variants.length > 1) {
        onOpenProduct(tile);
        return;
      }
      const r = await addProductsToCart([tile.id]);
      if (r.added === 0) {
        const full = r.atLimit > 0 && r.unavailable === 0;
        showBagToast({
          title: full ? "Already in your bag" : "Couldn't add this",
          detail: full
            ? "You already have as many as you can add."
            : "It's sold out or no longer listed.",
          viewBag: full,
        });
        return;
      }
      showBagToast({
        title: "Added to your bag",
        detail: tile.title,
        image: tile.photos[0]?.url ?? null,
        viewBag: true,
      });
    } catch {
      showBagToast({
        title: "Couldn't add to your bag",
        detail: "Check your connection and try again.",
      });
    }
  }

  const element = (
    <>
      {menu && (
        <TileMenu
          anchor={menu.anchor}
          onClose={() => setMenu(null)}
          onAddToCart={() => void addToCart(menu.tile)}
          onRelated={() => setRelatedId(menu.tile.id)}
          onMakeOffer={() => setOfferLocked(true)}
        />
      )}
      {relatedId && <RelatedContent productId={relatedId} onClose={() => setRelatedId(null)} />}
      {offerLocked && <SalesLockedNotice onClose={() => setOfferLocked(false)} />}
      {bagToast}
      {lockedBanner}
    </>
  );

  return { open: (tile, anchor) => setMenu({ tile, anchor }), element };
}

function TileMenu({
  anchor,
  onClose,
  onAddToCart,
  onRelated,
  onMakeOffer,
}: {
  anchor: DOMRect;
  onClose: () => void;
  onAddToCart: () => void;
  onRelated: () => void;
  onMakeOffer: () => void;
}) {
  // A fixed box can't follow a tile that moves, so anything that moves the page
  // under it (scrolling, resizing) just closes it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onClose, { capture: true, passive: true });
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onClose, { capture: true });
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  // Right edges line up with the button, above it when there's room, else below.
  const left = Math.min(
    Math.max(EDGE, anchor.right - MENU_WIDTH),
    window.innerWidth - MENU_WIDTH - EDGE,
  );
  const above = anchor.top - MENU_HEIGHT - 8 >= EDGE;
  const top = above ? anchor.top - MENU_HEIGHT - 8 : anchor.bottom + 8;

  const row =
    "flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] font-medium text-white transition-colors hover:bg-white/10 active:bg-white/15";
  const choose = (action: () => void) => () => {
    onClose();
    action();
  };

  return createPortal(
    <>
      {/* Catches the tap that dismisses the menu; transparent, under it. */}
      <div className="fixed inset-0 z-[109]" onClick={onClose} />
      <div
        role="menu"
        aria-label="Product options"
        // top-0 left-0 pin it explicitly (a fixed box with no offset class drifts
        // on iOS); the inline left/top below are the real position.
        className={`${GLASS_RIM} fixed left-0 top-0 z-[110] rounded-2xl p-1.5 animate-in fade-in zoom-in-95 duration-150`}
        style={{ ...glassDark, left, top, width: MENU_WIDTH }}
      >
        <button type="button" role="menuitem" className={row} onClick={choose(onAddToCart)}>
          <ShoppingBag size={19} strokeWidth={2} />
          Add to cart
        </button>
        <button type="button" role="menuitem" className={row} onClick={choose(onRelated)}>
          <Clapperboard size={19} strokeWidth={2} />
          See related content
        </button>
        <button type="button" role="menuitem" className={row} onClick={choose(onMakeOffer)}>
          <HandCoins size={19} strokeWidth={2} />
          Make offer
        </button>
      </div>
    </>,
    document.body,
  );
}

/** The posts that link one product, in a pop-up over the storefront (a sheet
 *  on a phone, a centred card on a laptop), closed by its X, a tap outside
 *  or swipe-back. PostFeed's own standalone mode sits under the product and
 *  collection pages, so it is hosted here in embedded mode on a higher layer;
 *  on a laptop it is held to a phone-shaped column. */
function RelatedContent({ productId, onClose }: { productId: string; onClose: () => void }) {
  // Armed a beat after mount, as in ProductPage: under StrictMode (dev) the
  // history hook's effect runs twice and its own cleanup would close this at once.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setArmed(true), 80);
    return () => clearTimeout(t);
  }, []);
  useOverlayHistory(armed, onClose);

  if (typeof document === "undefined") return null;
  return createPortal(
    // A pop-up over the storefront, not a trip to a feed page: the store stays
    // visible (dimmed) behind it, a tap outside closes it. A sheet rising from
    // the bottom on a phone; a centred, phone-shaped card on a laptop.
    <div
      className="fixed inset-0 z-[95] flex items-end justify-center bg-black/55 backdrop-blur-sm animate-in fade-in duration-200 md:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Related content"
        onClick={(e) => e.stopPropagation()}
        className="relative h-[88dvh] w-full overflow-hidden rounded-t-[28px] bg-black shadow-2xl ring-1 ring-white/10 animate-in slide-in-from-bottom-6 duration-300 md:h-[min(86dvh,860px)] md:w-auto md:aspect-[9/16] md:rounded-[28px] md:zoom-in-95 md:slide-in-from-bottom-0"
      >
        {/* Just the X: PostFeed gets no onClose here, so it draws no back arrow
            of its own to collide with it. */}
        <div className="pointer-events-none absolute right-0 top-0 z-30 p-3.5">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close related content"
            className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25"
          >
            <X size={18} />
          </button>
        </div>
        {/* 9:16 at most, as in the storefront feed, so the side buttons sit on
            the post rather than out at the sheet edge on a wide screen. */}
        <div className="mx-auto aspect-[9/16] h-full max-w-full">
          <PostFeed mode="embedded" scope={{ type: "product", productId }} storePicture={null} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
