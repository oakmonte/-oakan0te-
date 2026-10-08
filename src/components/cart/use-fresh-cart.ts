import { useCallback, useEffect, useRef, useState } from "react";
import { reconcileCart, type CartItem, type CartNotice, type FreshProduct } from "@/lib/cart";
import { loadFreshProducts } from "@/lib/cart-quote";

/** Re-reads the bag's products from the database and brings the stored bag in
 *  line with them (prices, stock, titles), keeping a list of what changed so
 *  the screen can say so. Shared by the bag and its checkout.
 *
 *  Each product is looked up once per mount; a product that appears later
 *  (added in another tab) is looked up on its own, so the rest of the bag
 *  doesn't flicker back to "checking" every time something changes. */
export function useFreshCart(items: CartItem[], enabled: boolean) {
  const [fresh, setFresh] = useState<Map<string, FreshProduct> | null>(null);
  const [queried, setQueried] = useState<Set<string>>(() => new Set());
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState(false);
  const [notices, setNotices] = useState<CartNotice[]>([]);
  // Asked about, answered or still in flight. A ref, not state: it gates the
  // effect below and must not re-run it.
  const asked = useRef(new Set<string>());

  const productKey = [...new Set(items.map((i) => i.productId))].sort().join(",");

  const check = useCallback(async (ids: string[]) => {
    for (const id of ids) asked.current.add(id);
    setPending((n) => n + 1);
    setFailed(false);
    try {
      const map = await loadFreshProducts(ids);
      const found = reconcileCart(map, new Set(ids));
      setFresh((prev) => {
        const next = new Map(prev ?? []);
        for (const id of ids) {
          const p = map.get(id);
          if (p) next.set(id, p);
          else next.delete(id);
        }
        return next;
      });
      setQueried((prev) => new Set([...prev, ...ids]));
      if (found.length > 0) {
        setNotices((prev) => [
          ...prev.filter((n) => !found.some((f) => f.variantId === n.variantId)),
          ...found,
        ]);
      }
    } catch (err) {
      console.error("bag: couldn't check products", err);
      for (const id of ids) asked.current.delete(id);
      setFailed(true);
    } finally {
      setPending((n) => n - 1);
    }
  }, []);

  useEffect(() => {
    if (!enabled || !productKey) return;
    const unasked = productKey.split(",").filter((id) => !asked.current.has(id));
    if (unasked.length > 0) void check(unasked);
  }, [enabled, productKey, check]);

  const retry = useCallback(() => {
    if (productKey) void check(productKey.split(","));
  }, [productKey, check]);

  return { fresh, queried, checking: pending > 0, failed, notices, retry };
}
