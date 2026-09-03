import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { Check, X } from "lucide-react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { useOwnStores } from "@/hooks/use-own-store";
import type { TaggedProduct } from "@/components/feed/PostFeed";

/** "Link products" for the owner of a post: every product they have listed,
 *  with the ones already on this post ticked. Writes straight to
 *  `post_product_tags`, the same table the publish flow's product tagger
 *  writes — this is that step, reachable again after the fact, so a post can
 *  pick up products that didn't exist when it went out.
 *
 *  A linked product is what makes the post shoppable: it's what draws the
 *  product chips under the caption and what the viewer's Listed items tab
 *  reads.
 *
 *  "Published" here means `status = 'active'`, matching what the publish
 *  flow's tagger offers — a draft product has no price or images to show on
 *  a chip. */
export function LinkProductsSheet({
  open,
  onClose,
  postId,
  linked,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  postId: string;
  linked: TaggedProduct[];
  onChange: (next: TaggedProduct[]) => void;
}) {
  const navigate = useNavigate();
  const { stores, loading: storesLoading } = useOwnStores();
  const [products, setProducts] = useState<TaggedProduct[] | null>(null);
  // Ids mid-write, so a double tap can't fire two inserts for one product.
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const linkedIds = new Set(linked.map((p) => p.id));

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open || storesLoading) return;
    const storeIds = stores.map((s) => s.id);
    if (storeIds.length === 0) {
      setProducts([]);
      return;
    }
    let cancelled = false;
    // Across every store the account owns, not just the active one: the rail
    // is on a personal post, which isn't scoped to a store at all.
    supabase
      .from("products")
      .select("id, title, product_variants(price, main_image_url)")
      .in("store_id", storeIds)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("LinkProductsSheet: failed to load products", error);
          setProducts([]);
          return;
        }
        setProducts(
          (data ?? []).map((p) => ({
            id: p.id,
            title: p.title ?? "Untitled",
            price: p.product_variants[0]?.price ?? null,
            image: p.product_variants[0]?.main_image_url ?? null,
          })),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [open, stores, storesLoading]);

  async function toggle(product: TaggedProduct) {
    if (busy.has(product.id)) return;
    const wasLinked = linkedIds.has(product.id);
    // Optimistic: the tick and the chips under the caption both move now, and
    // roll back together if the write fails.
    const next = wasLinked
      ? linked.filter((p) => p.id !== product.id)
      : [...linked, { ...product }];
    onChange(next);
    setBusy((s) => new Set(s).add(product.id));
    try {
      const { error } = wasLinked
        ? await supabase
            .from("post_product_tags")
            .delete()
            .eq("post_id", postId)
            .eq("product_id", product.id)
        : await supabase.from("post_product_tags").insert({
            post_id: postId,
            product_id: product.id,
          });
      if (error) throw error;
    } catch (err) {
      console.error("LinkProductsSheet: link toggle failed", err);
      onChange(linked);
    } finally {
      setBusy((s) => {
        const copy = new Set(s);
        copy.delete(product.id);
        return copy;
      });
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[90] flex flex-col justify-end">
          <motion.div
            className="absolute inset-0 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="relative flex flex-col rounded-t-[14px] bg-[#1c1c1e] text-white"
            style={{ height: "68vh" }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 460, damping: 44 }}
            drag="y"
            dragDirectionLock
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.7 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose();
            }}
          >
            <div className="flex justify-center pt-2 pb-1">
              <span className="h-1 w-9 rounded-full bg-white/25" />
            </div>

            <div className="relative flex items-center justify-center px-4 pb-3">
              <span className="text-[14px] font-semibold">Link products</span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="absolute right-4 text-white active:scale-90"
              >
                <X size={22} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-6">
              {products === null || storesLoading ? (
                <div className="flex flex-col gap-2 pt-1">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-[62px] animate-pulse rounded-xl bg-white/[0.06]" />
                  ))}
                </div>
              ) : products.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                  <p className="max-w-[240px] text-[13px] text-white/50">
                    {stores.length === 0
                      ? "Set up your store before you can link products to a post."
                      : "You have no listed products to link yet."}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      navigate({ to: stores.length === 0 ? "/store" : "/store/products/new" });
                    }}
                    className="rounded-full bg-white px-5 py-2.5 text-[13px] font-semibold text-black active:scale-95"
                  >
                    {stores.length === 0 ? "Set up store" : "List a product"}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col">
                  {products.map((p) => {
                    const isLinked = linkedIds.has(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => void toggle(p)}
                        aria-pressed={isLinked}
                        className="flex items-center gap-3 py-2.5 text-left active:opacity-70"
                      >
                        <img
                          src={p.image ?? "https://placehold.co/48x48"}
                          alt=""
                          className="h-12 w-12 shrink-0 rounded-lg bg-white/10 object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium">{p.title}</p>
                          {p.price != null && (
                            <p className="text-[12px] text-white/45">₦{p.price.toLocaleString()}</p>
                          )}
                        </div>
                        <span
                          className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border transition-colors ${
                            isLinked ? "border-white bg-white text-black" : "border-white/35"
                          }`}
                        >
                          {isLinked && <Check size={13} strokeWidth={3} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
