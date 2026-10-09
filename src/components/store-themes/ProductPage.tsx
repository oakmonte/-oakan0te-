import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ShieldCheck } from "lucide-react";
import { PaperPlaneTilt } from "@/components/icons/phosphor";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { useOverlayHistory } from "@/hooks/use-overlay-history";
import { useBagToast } from "@/components/cart/BagToast";
import { addToCart } from "@/lib/cart";
import { MAX_LINE_QTY, stockCeiling, variantLabelOf } from "@/lib/order-lines";
import type { PreviewTile } from "./storefront-catalog";
import type { StorefrontLook } from "./storefront-look";
import { EnquirySheet } from "./EnquirySheet";
import { useStorefrontChat } from "@/lib/buyer-session";
import { SALES_LOCKED } from "@/lib/launch-locks";

const PUSH = "cubic-bezier(0.32, 0.72, 0, 1)";
const OPEN_MS = 380;
const CLOSE_MS = 260;

type Variant = {
  id: string;
  price: number | null;
  compare_at_price: number | null;
  stock_qty: number | null;
  continue_selling_out_of_stock: boolean;
  option1_name: string | null;
  option1_value: string | null;
  option2_value: string | null;
  option3_value: string | null;
  main_image_url: string | null;
  additional_image_urls: string[] | null;
};

type ProductData = {
  title: string;
  description: string | null;
  variants: Variant[];
  storeId: string;
  store: { brand_name: string; logo_url: string | null } | null;
  /** The owner's personal username, which /messages?to= resolves. */
  ownerUsername: string | null;
};

async function loadProduct(productId: string): Promise<ProductData | null> {
  const { data, error } = await supabase
    .from("products")
    .select(
      "title, description_long, description_short, store_id, product_variants(id, price, compare_at_price, stock_qty, continue_selling_out_of_stock, option1_name, option1_value, option2_value, option3_value, main_image_url, additional_image_urls)",
    )
    .eq("id", productId)
    .eq("status", "active")
    .order("created_at", { referencedTable: "product_variants", ascending: true })
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("product page", error);
    return null;
  }
  const { data: store } = await supabase
    .from("stores")
    .select("brand_name, logo_url, owner_id")
    .eq("id", data.store_id)
    .maybeSingle();
  const { data: owner } = store
    ? await supabase
        .from("profiles")
        .select("personal_username")
        .eq("id", store.owner_id)
        .maybeSingle()
    : { data: null };
  return {
    title: data.title ?? "Untitled",
    description: data.description_long?.trim() || data.description_short?.trim() || null,
    variants: (data.product_variants ?? []) as Variant[],
    storeId: data.store_id,
    store: store ? { brand_name: store.brand_name, logo_url: store.logo_url } : null,
    ownerUsername: owner?.personal_username ?? null,
  };
}

function inStock(v: Variant) {
  return v.continue_selling_out_of_stock || (v.stock_qty ?? 0) > 0;
}

/** A storefront product opened as its own page: photos, name, size picker,
 *  price, the buy actions, the buyer-protection note, description and the
 *  seller. Pushes in from the right like CollectionPage. Buy Now goes to
 *  checkout and Add to Bag fills the bag; Make Offer isn't built yet, so it
 *  calls onAction (the storefront's notice). */
export function ProductPage({
  tile,
  look,
  onClose,
  onAction,
  embedded = false,
  visible = true,
}: {
  tile: PreviewTile;
  look: StorefrontLook;
  onClose: () => void;
  onAction: () => void;
  /** Drawn inside a host pane (a store feed's Listed items with one linked
   *  piece) instead of sliding over the screen: no back button, no claim on
   *  the phone's back gesture. */
  embedded?: boolean;
  /** For an embedded page: whether its pane is on screen. The sales-locked
   *  notice waits for that rather than firing while it's off to the side. */
  visible?: boolean;
}) {
  const navigate = useNavigate();
  const [askAccount, setAskAccount] = useState(false);
  const [confirmGuest, setConfirmGuest] = useState(false);
  function goCheckout() {
    void navigate({
      to: "/checkout/$productId",
      params: { productId: tile.id },
      search: { variant: variant?.id },
    });
  }
  // Signed-in buyers go straight through; everyone else is invited to sign in
  // or create an account, but can carry on as a guest.
  async function buyNow() {
    const { data: sess } = await supabase.auth.getSession();
    if (sess.session) goCheckout();
    else {
      setConfirmGuest(false);
      setAskAccount(true);
    }
  }
  const { toast: bagToast, showBagToast } = useBagToast();
  // On a store's website the message button opens an enquiry about this
  // piece (EnquirySheet); anywhere else it falls back to plain Messages.
  const storefrontChat = useStorefrontChat();
  // Until launch, say up front that this can't be bought yet, so nobody
  // reads the buttons as live (lib/launch-locks.ts). Once per opening.
  const announcedLock = useRef(false);
  useEffect(() => {
    if (!SALES_LOCKED || !visible || announcedLock.current) return;
    announcedLock.current = true;
    onAction();
  }, [onAction, visible]);
  const [enquiryOpen, setEnquiryOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const [closing, setClosing] = useState(false);
  const [data, setData] = useState<ProductData | null | undefined>(undefined);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [photoIdx, setPhotoIdx] = useState(0);
  const reduceMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    let cancelled = false;
    void loadProduct(tile.id).then((d) => {
      if (cancelled) return;
      setData(d);
      const first = d?.variants.find(inStock) ?? d?.variants[0];
      setVariantId(first?.id ?? null);
    });
    const raf = requestAnimationFrame(() => setShown(true));
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [tile.id]);

  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function close() {
    if (closing) return;
    setClosing(true);
    setShown(false);
    closeTimer.current = setTimeout(onClose, reduceMotion ? 150 : CLOSE_MS);
  }
  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );
  // Armed a beat after mount: under StrictMode (dev) the hook's history
  // effect runs twice and its own cleanup pop would close the page at once.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setArmed(true), 80);
    return () => clearTimeout(t);
  }, []);
  useOverlayHistory(!embedded && armed && !closing, close);

  const variants = data?.variants ?? [];
  const variant = variants.find((v) => v.id === variantId) ?? variants[0];
  const sizeName = variants.find((v) => v.option1_name)?.option1_name ?? null;
  const hasChoice = variants.length > 1 && !!sizeName;

  // The selected variant's photos; fall back to the tile's own photos.
  const urls = variant
    ? [variant.main_image_url, ...(variant.additional_image_urls ?? [])].filter(
        (u): u is string => !!u && u.trim() !== "",
      )
    : [];
  const photos = urls.length > 0 ? urls : tile.photos.map((p) => p.url);
  const price = variant?.price ?? tile.price;
  const compareAt = variant?.compare_at_price ?? tile.compareAtPrice;
  const soldOut = variant ? !inStock(variant) : false;

  // The selected variant, exactly as it will be bought. Prices and stock here
  // are what this page loaded; the bag re-checks them when it opens and the
  // server re-prices at checkout.
  function addToBag() {
    // No price (null or an unset 0) can't be ordered; the server refuses it.
    if (!data || !variant || !variant.price) return;
    const label = variantLabelOf(variant, variants.length);
    const ceiling = stockCeiling(variant);
    const added = addToCart({
      productId: tile.id,
      variantId: variant.id,
      title: data.title,
      variantLabel: label,
      imageUrl: photos[0] ?? null,
      unitPrice: variant.price,
      storeId: data.storeId,
      storeName: data.store?.brand_name ?? "Store",
      maxQuantity: ceiling,
    });
    showBagToast({
      // Nothing goes in only when the line is already full: every one in
      // stock, or as many as one order can carry.
      title: added > 0 ? "Added to your bag" : "Already in your bag",
      detail:
        added > 0
          ? label
            ? `${data.title} · ${label}`
            : data.title
          : ceiling !== null && ceiling < MAX_LINE_QTY
            ? "You have all the ones that are left."
            : `That's the most one order can take (${MAX_LINE_QTY}).`,
      image: photos[0] ?? null,
      viewBag: true,
    });
  }

  const pageStyle: CSSProperties = {
    background: look.background,
    backgroundImage: look.backgroundImage,
    fontFamily: look.fontFamily,
    color: look.textColor,
    transform: reduceMotion ? undefined : shown ? "translateX(0)" : "translateX(100%)",
    opacity: reduceMotion ? (shown ? 1 : 0) : 1,
    transition: reduceMotion
      ? "opacity 150ms ease"
      : `transform ${closing ? CLOSE_MS : OPEN_MS}ms ${PUSH}`,
    boxShadow: "-12px 0 32px rgba(0,0,0,0.25)",
  };
  const btn: CSSProperties = { background: look.textColor, color: look.background || "#000" };

  if (typeof document === "undefined") return null;
  return (
    <>
      {(() => {
        const page = (
          <div
            className={
              embedded
                ? "h-full overflow-y-auto overscroll-contain"
                : "fixed inset-0 z-[90] overflow-y-auto overscroll-contain"
            }
            style={
              embedded ? { ...pageStyle, transform: undefined, boxShadow: undefined } : pageStyle
            }
          >
            {!embedded && (
              <div
                className="sticky top-0 z-10 px-3 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)]"
                style={{ background: look.background || undefined }}
              >
                <button
                  type="button"
                  onClick={close}
                  aria-label="Back"
                  className="grid h-10 w-10 place-items-center rounded-full bg-black/45 text-white"
                >
                  <ChevronLeft size={22} />
                </button>
              </div>
            )}

            <div className="mx-auto max-w-[520px] pb-[calc(env(safe-area-inset-bottom)+2rem)]">
              <div className="mx-3 overflow-hidden rounded-3xl" style={{ background: look.tileBg }}>
                {photos.length > 0 ? (
                  <div
                    className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    onScroll={(e) => {
                      const el = e.currentTarget;
                      setPhotoIdx(Math.round(el.scrollLeft / el.clientWidth));
                    }}
                  >
                    {photos.map((u, i) => (
                      <img
                        key={u + i}
                        src={u}
                        alt={i === 0 ? tile.title : ""}
                        className="aspect-[4/5] w-full shrink-0 snap-center object-cover"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="aspect-[4/5] w-full" />
                )}
              </div>
              {photos.length > 1 && (
                <div className="mt-2 flex justify-center gap-1.5">
                  {photos.map((_, i) => (
                    <span
                      key={i}
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: look.textColor, opacity: i === photoIdx ? 1 : 0.3 }}
                    />
                  ))}
                </div>
              )}

              <div className="px-4 pt-4">
                <h1 className="text-[22px] font-medium leading-tight">
                  {data?.title ?? tile.title}
                </h1>

                {hasChoice && (
                  <div className="mt-3">
                    <p className="text-[14px]" style={{ color: look.mutedColor }}>
                      {sizeName}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {variants.map((v) => {
                        const active = v.id === variant?.id;
                        const out = !inStock(v);
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => {
                              setVariantId(v.id);
                              setPhotoIdx(0);
                            }}
                            className="rounded-full border px-3.5 py-1.5 text-[14px]"
                            style={{
                              borderColor: look.textColor,
                              background: active ? look.textColor : "transparent",
                              color: active ? look.background || "#000" : look.textColor,
                              opacity: out ? 0.4 : 1,
                              textDecoration: out ? "line-through" : undefined,
                            }}
                          >
                            {v.option1_value}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <p className="mt-3 text-[17px]">
                  {price != null ? `₦${price.toLocaleString()}` : ""}
                  {compareAt != null && price != null && compareAt > price && (
                    <span
                      className="ml-2 text-[14px] line-through"
                      style={{ color: look.mutedColor }}
                    >
                      ₦{compareAt.toLocaleString()}
                    </span>
                  )}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-2.5">
                  <div className="col-span-2 flex gap-2.5">
                    <button
                      type="button"
                      disabled={soldOut}
                      // Until Paystack is live: the same "Sales are still locked
                      // until full launch" notice as on main (lib/launch-locks.ts).
                      onClick={SALES_LOCKED ? onAction : () => void buyNow()}
                      className="h-14 min-w-0 flex-1 rounded-2xl text-[18px] font-semibold disabled:opacity-40"
                      style={btn}
                    >
                      {soldOut ? "Sold out" : "Buy Now"}
                    </button>
                    {data && (
                      <button
                        type="button"
                        aria-label="Message the seller"
                        onClick={() =>
                          storefrontChat
                            ? setEnquiryOpen(true)
                            : void navigate({
                                to: "/messages",
                                search: data.ownerUsername ? { to: data.ownerUsername } : {},
                              })
                        }
                        className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl"
                        style={btn}
                      >
                        <PaperPlaneTilt size={24} />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={onAction}
                    className="h-14 rounded-2xl text-[16px] font-semibold"
                    style={btn}
                  >
                    Make Offer
                  </button>
                  <button
                    type="button"
                    disabled={soldOut || !data || !variant?.price}
                    onClick={addToBag}
                    className="h-14 rounded-2xl text-[16px] font-semibold disabled:opacity-40"
                    style={btn}
                  >
                    Add to Bag
                  </button>
                </div>

                <div
                  className="mt-5 flex items-start gap-3 border-t pt-4"
                  style={{ borderColor: look.tileBg }}
                >
                  <ShieldCheck size={28} className="mt-0.5 shrink-0" />
                  <p className="text-[14px] leading-snug">
                    ALL purchases in Oakmonte are covered by us. (it is physically impossible to be
                    scammed here and one in a trillion situations WILL be refunded)
                  </p>
                </div>

                {data === undefined && <div className="mt-6 h-24" />}
                {data === null && (
                  <p className="mt-6 text-[14px]" style={{ color: look.mutedColor }}>
                    This product isn&apos;t available right now.
                  </p>
                )}
                {data?.description && (
                  <div className="mt-5 border-t pt-4" style={{ borderColor: look.tileBg }}>
                    <p className="text-[16px] font-medium">Description</p>
                    <ul
                      className="mt-1.5 list-disc space-y-1 pl-5 text-[15px] leading-relaxed"
                      style={{ color: look.mutedColor }}
                    >
                      {data.description
                        .split(String.fromCharCode(10))
                        .map((line) => line.replace(/^\s*[-•*]\s*/, "").trim())
                        .filter(Boolean)
                        .map((line, i) => (
                          <li key={i}>{line}</li>
                        ))}
                    </ul>
                  </div>
                )}
                {data?.store && (
                  <div
                    className="mt-5 flex items-center gap-3 border-t pt-4"
                    style={{ borderColor: look.tileBg }}
                  >
                    {data.store.logo_url ? (
                      <img
                        src={data.store.logo_url}
                        alt=""
                        className="h-11 w-11 rounded-full object-cover"
                      />
                    ) : (
                      <span
                        className="grid h-11 w-11 place-items-center rounded-full text-[16px]"
                        style={{ background: look.tileBg }}
                      >
                        {data.store.brand_name.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <p className="text-[15px] font-medium">{data.store.brand_name}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
        return embedded ? page : createPortal(page, document.body);
      })()}
      {askAccount &&
        createPortal(
          <div className="fixed inset-0 z-[200]" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/40" onClick={() => setAskAccount(false)} />
            <div
              className="absolute inset-x-3 rounded-[26px] bg-white px-6 pb-5 pt-7 text-center text-black shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
              style={{ bottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
            >
              <h2 className="text-[20px] font-bold leading-tight">
                {confirmGuest ? "Are you sure?" : "Get the best experience"}
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed text-black/60">
                {confirmGuest
                  ? "Without an account you can't track this order in the app, message the seller or make offers. We'll email your updates instead."
                  : "Sign in or create an account to track your order, message sellers and make offers."}
              </p>
              <button
                type="button"
                onClick={() => void navigate({ to: "/sign-in" })}
                className="mt-6 h-12 w-full rounded-full bg-black text-[15px] font-semibold text-white"
              >
                {confirmGuest ? "Create an account" : "Sign in or create an account"}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!confirmGuest) {
                    setConfirmGuest(true);
                    return;
                  }
                  setAskAccount(false);
                  goCheckout();
                }}
                className="mt-2 h-11 w-full rounded-full text-[15px] font-semibold text-black/60"
              >
                {confirmGuest ? "Yes, continue as a guest" : "Continue without an account"}
              </button>
            </div>
          </div>,
          document.body,
        )}
      {bagToast}
      {enquiryOpen && data && (
        <EnquirySheet
          product={{
            id: tile.id,
            title: data.title,
            price: variant?.price ?? null,
            images: photos.slice(0, 6),
          }}
          onClose={() => setEnquiryOpen(false)}
          onSent={() => {
            setEnquiryOpen(false);
            storefrontChat?.openMessages();
            close();
          }}
        />
      )}
    </>
  );
}
