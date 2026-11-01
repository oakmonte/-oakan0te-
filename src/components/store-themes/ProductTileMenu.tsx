import { useEffect, useRef, useState, type ReactNode } from "react";
import { OFFERS_ENABLED } from "@/lib/features";
import { createPortal } from "react-dom";
import { Clapperboard, HandCoins, ShoppingBag, X } from "lucide-react";
import { PostFeed } from "@/components/feed/PostFeed";
import { useBagToast } from "@/components/cart/BagToast";
import { useLockedBanner } from "@/components/LockedBanner";
import { useOverlayHistory } from "@/hooks/use-overlay-history";
import { addProductsToCart } from "@/lib/cart-quote";
import { GLASS_RIM, glassDark } from "@/lib/liquid-glass";
import type { PreviewTile } from "./storefront-catalog";

const MENU_WIDTH = 232;
// Three 44px rows plus padding; used only to decide whether the menu opens
// above the button or below it.
const MENU_HEIGHT = OFFERS_ENABLED ? 152 : 104;
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
 *  - Add to cart: straight into the bag with an "Added to cart" notice. A
 *    product with several sizes goes in on its first available one, flagged so
 *    the bag asks for the real size before checkout (addProductsToCart).
 *  - See related content: the store's posts that link this product, in a
 *    full-screen viewer.
 *  - Make offer: hidden while OFFERS_ENABLED is off (lib/features.ts). */
export function useProductTileMenu(onOpenProduct: (tile: PreviewTile) => void): {
  open: (tile: PreviewTile, anchor: DOMRect) => void;
  element: ReactNode;
} {
  const [menu, setMenu] = useState<{ tile: PreviewTile; anchor: DOMRect } | null>(null);
  const [related, setRelated] = useState<{ id: string; anchor: DOMRect } | null>(null);
  const { toast: bagToast, showBagToast } = useBagToast();
  const { banner: lockedBanner, showLocked } = useLockedBanner();

  async function addToCart(tile: PreviewTile) {
    try {
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
        title: "Added to cart",
        detail: r.needChoice > 0 ? `${tile.title} · pick your size in the bag` : tile.title,
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
          onRelated={() => setRelated({ id: menu.tile.id, anchor: menu.anchor })}
          onMakeOffer={() => onOpenProduct(menu.tile)}
        />
      )}
      {related && (
        <RelatedContent
          productId={related.id}
          anchor={related.anchor}
          onClose={() => setRelated(null)}
        />
      )}
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
        {OFFERS_ENABLED && (
          <button type="button" role="menuitem" className={row} onClick={choose(onMakeOffer)}>
            <HandCoins size={19} strokeWidth={2} />
            Make offer
          </button>
        )}
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
function RelatedContent({
  productId,
  anchor,
  onClose,
}: {
  productId: string;
  anchor: DOMRect;
  onClose: () => void;
}) {
  // Armed a beat after mount, as in ProductPage: under StrictMode (dev) the
  // history hook's effect runs twice and its own cleanup would close this at once.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setArmed(true), 80);
    return () => clearTimeout(t);
  }, []);
  useOverlayHistory(armed, onClose);

  if (typeof document === "undefined") return null;

  // Beside the tile it was opened from: to its right, else its left, a phone-
  // shaped card level with it. Where neither side has room (a phone), centred.
  const M = 12;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const height = Math.min(vh - M * 2, 620);
  const width = Math.round((height * 9) / 16);
  let left = anchor.right + M;
  if (left + width > vw - M) left = anchor.left - M - width;
  if (left < M) left = Math.round((vw - width) / 2);
  const top = Math.min(Math.max(anchor.top, M), vh - height - M);

  return createPortal(
    <div
      className="fixed inset-0 z-[95] bg-black/20 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Related content"
        onClick={(e) => e.stopPropagation()}
        // No buttons in here: up/down and side to side are swipes (or a
        // trackpad's two-finger scroll), so the post carousel's own arrows hide.
        className="absolute overflow-hidden rounded-[24px] bg-black shadow-2xl ring-1 ring-white/10 animate-in fade-in zoom-in-95 duration-200 [&_button[aria-label='Next_photo']]:!hidden [&_button[aria-label='Previous_photo']]:!hidden"
        style={{ left, top, width, height }}
      >
        {/* Just the X: PostFeed gets no onClose here, so it draws no back arrow
            of its own to collide with it. */}
        <div className="pointer-events-none absolute right-0 top-0 z-30 p-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close related content"
            className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25"
          >
            <X size={18} />
          </button>
        </div>
        <PostFeed mode="embedded" scope={{ type: "product", productId }} storePicture={null} />
      </div>
    </div>,
    document.body,
  );
}
