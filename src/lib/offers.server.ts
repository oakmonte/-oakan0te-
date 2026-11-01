import { supabaseAdmin } from "@/lib/integrations/my-supabase/client.server";
import { untypedTable } from "@/lib/integrations/my-supabase/untyped";

// Make Offer (migration 20261101120000_offers.sql), the way Depop does it: the
// buyer names a price, the seller accepts or counters, the buyer accepts a
// counter, and the agreed price is the one checkout charges. Every read and
// write is here, with the service role -- the routes check who's asking.

export type OfferStatus = "pending" | "countered" | "accepted" | "used";

export type OfferRow = {
  id: string;
  store_id: string;
  product_id: string;
  variant_id: string;
  buyer_id: string;
  list_price_kobo: number;
  amount_kobo: number;
  counter_kobo: number | null;
  agreed_kobo: number | null;
  status: OfferStatus;
  order_id: string | null;
  created_at: string;
  updated_at: string;
};

/** An offer as the screens show it: the piece, its photo and the prices. */
export type OfferView = {
  id: string;
  status: OfferStatus;
  productId: string;
  variantId: string;
  title: string;
  variantLabel: string | null;
  image: string | null;
  storeName: string | null;
  listPrice: number;
  amount: number;
  counter: number | null;
  agreed: number | null;
  createdAt: string;
  updatedAt: string;
};

/** Lowest offer allowed, as a share of the listed price (Depop-style floor:
 *  stops ₦1 offers without stopping real haggling). */
export const MIN_OFFER_SHARE = 0.5;

const COLUMNS =
  "id, store_id, product_id, variant_id, buyer_id, list_price_kobo, amount_kobo, counter_kobo, agreed_kobo, status, order_id, created_at, updated_at";

export const offersTable = () => untypedTable(supabaseAdmin, "offers");

export async function loadOffer(id: string): Promise<OfferRow | null> {
  const { data } = await offersTable().select(COLUMNS).eq("id", id).maybeSingle();
  return (data as OfferRow | null) ?? null;
}

export async function listOffers(filter: { buyerId?: string; storeId?: string }) {
  let q = offersTable().select(COLUMNS).order("updated_at", { ascending: false }).limit(100);
  if (filter.buyerId) q = q.eq("buyer_id", filter.buyerId);
  if (filter.storeId) q = q.eq("store_id", filter.storeId);
  const { data, error } = await q;
  if (error) throw error;
  return toViews((data ?? []) as OfferRow[]);
}

/** Adds the piece's title, variant, photo and store name for display. */
async function toViews(rows: OfferRow[]): Promise<OfferView[]> {
  if (rows.length === 0) return [];
  const productIds = [...new Set(rows.map((r) => r.product_id))];
  const variantIds = [...new Set(rows.map((r) => r.variant_id))];
  const storeIds = [...new Set(rows.map((r) => r.store_id))];
  const [{ data: products }, { data: variants }, { data: stores }] = await Promise.all([
    supabaseAdmin.from("products").select("id, title").in("id", productIds),
    supabaseAdmin
      .from("product_variants")
      .select("id, main_image_url, option1_value, option2_value, option3_value")
      .in("id", variantIds),
    supabaseAdmin.from("stores").select("id, brand_name").in("id", storeIds),
  ]);
  const title = new Map((products ?? []).map((p) => [p.id, p.title ?? "Untitled"]));
  const store = new Map((stores ?? []).map((s) => [s.id, s.brand_name ?? null]));
  const variant = new Map((variants ?? []).map((v) => [v.id, v]));
  return rows.map((r) => {
    const v = variant.get(r.variant_id);
    const label = v
      ? [v.option1_value, v.option2_value, v.option3_value].filter(Boolean).join(" / ") || null
      : null;
    return {
      id: r.id,
      status: r.status,
      productId: r.product_id,
      variantId: r.variant_id,
      title: title.get(r.product_id) ?? "Untitled",
      variantLabel: label,
      image: v?.main_image_url ?? null,
      storeName: store.get(r.store_id) ?? null,
      listPrice: r.list_price_kobo / 100,
      amount: r.amount_kobo / 100,
      counter: r.counter_kobo == null ? null : r.counter_kobo / 100,
      agreed: r.agreed_kobo == null ? null : r.agreed_kobo / 100,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  });
}

/** Moves an offer from one status to the next only if it's still in `from`,
 *  so two taps (or a buyer and seller at once) can't both win. */
export async function moveOffer(
  id: string,
  from: OfferStatus,
  patch: Partial<Pick<OfferRow, "status" | "counter_kobo" | "agreed_kobo" | "order_id">>,
): Promise<boolean> {
  const { data, error } = await offersTable()
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", from)
    .select("id");
  if (error) {
    console.error("moveOffer failed", id, error);
    return false;
  }
  return (data?.length ?? 0) > 0;
}

/** The agreed price for checkout, if `offerId` is this buyer's accepted offer
 *  on this exact variant. Null otherwise -- checkout then refuses. */
export async function agreedPriceFor(input: {
  offerId: string;
  buyerId: string | null;
  productId: string;
  variantId: string | null;
}): Promise<number | null> {
  if (!input.buyerId) return null;
  const offer = await loadOffer(input.offerId);
  if (
    !offer ||
    offer.status !== "accepted" ||
    offer.buyer_id !== input.buyerId ||
    offer.product_id !== input.productId ||
    (input.variantId && offer.variant_id !== input.variantId) ||
    !offer.agreed_kobo
  ) {
    return null;
  }
  return offer.agreed_kobo;
}

/** Called when an order is paid: its offer (if any) is spent. */
export async function markOfferUsed(orderId: string): Promise<void> {
  const { error } = await offersTable()
    .update({ status: "used", updated_at: new Date().toISOString() })
    .eq("order_id", orderId)
    .eq("status", "accepted");
  if (error) console.error("markOfferUsed failed", orderId, error);
}
