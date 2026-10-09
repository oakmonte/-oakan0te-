import { supabaseAdmin } from "@/lib/integrations/my-supabase/client.server";
import {
  getRequestUser,
  requireOwnStore,
  requireStoreOwner,
  type StoreAuthResult,
} from "@/lib/server-auth";
import {
  deriveCustomers,
  PAID_STATUSES,
  type CatalogProduct,
  type CustomerRow,
  type InsightOrder,
} from "@/lib/insights";

// Loaders shared by the api.store.insights.* handlers. Every one takes a
// storeId that has ALREADY been checked against the session by
// resolveInsightsStore -- they run on the service-role key, so they would
// happily read any store's rows if handed an unchecked id.

export const PRIVATE_HEADERS = {
  "Cache-Control": "no-store, private",
  Vary: "Authorization",
} as const;

export function privateJson(body: unknown, status = 200) {
  return Response.json(body, { status, headers: PRIVATE_HEADERS });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The store an insights request is about.
 *
 *  With no `?store=`, the seller's oldest store (requireOwnStore). With one,
 *  that store -- but only after requireStoreOwner has matched it to the
 *  session's owner_id, answering 404 for anyone else's. The id is accepted at
 *  all because the dashboard has a store switcher: without it, a seller looking
 *  at their second store would be shown their first store's sales under the
 *  second store's name. The id selects; the session authorizes. */
export async function resolveInsightsStore(request: Request): Promise<StoreAuthResult> {
  const requested = new URL(request.url).searchParams.get("store");
  if (!requested) return requireOwnStore(request);
  if (!UUID.test(requested)) {
    // A malformed id would reach Postgres as a cast error, i.e. a 500 that
    // looks different from the 404 a well-formed stranger's id gets.
    const user = await getRequestUser(request);
    if (!user) return { ok: false, response: privateJson({ error: "Not signed in" }, 401) };
    return { ok: false, response: privateJson({ error: "Store not found" }, 404) };
  }
  return requireStoreOwner(request, requested);
}

const PAGE = 1000;
/** A ceiling on one request's work. Far above any store's volume today; the
 *  handlers report `truncated` rather than presenting a partial sum as whole. */
const MAX_ORDERS = 10_000;

const ORDER_COLUMNS =
  "id, created_at, status, items_total_kobo, buyer_id, guest_email, ship_to, order_items(product_id, title, image_url, unit_price_kobo, quantity)";

/** Paid orders (paid, shipped, delivered) of one store with their lines,
 *  newest first. Unpaid, declined and cancelled orders are never revenue and
 *  their buyers are not customers. */
export async function loadPaidOrders(
  storeId: string,
  sinceIso: string | null,
): Promise<{ orders: InsightOrder[]; truncated: boolean }> {
  const orders: InsightOrder[] = [];
  for (let from = 0; from < MAX_ORDERS; from += PAGE) {
    let query = supabaseAdmin
      .from("orders")
      .select(ORDER_COLUMNS)
      .eq("store_id", storeId)
      .in("status", [...PAID_STATUSES])
      // id breaks created_at ties, so paging can't skip or repeat a row.
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + PAGE - 1);
    if (sinceIso) query = query.gte("created_at", sinceIso);
    const { data, error } = await query;
    if (error) throw error;
    for (const { order_items, ...row } of data ?? []) {
      orders.push({ ...row, items: order_items ?? [] });
    }
    if ((data?.length ?? 0) < PAGE) return { orders, truncated: false };
  }
  return { orders, truncated: true };
}

const MAX_PRODUCTS = 5_000;

/** Every product of the store with the variant fields the catalogue checks
 *  read. Drafts and archived products are included; each check decides. */
export async function loadCatalog(storeId: string): Promise<CatalogProduct[]> {
  const products: CatalogProduct[] = [];
  for (let from = 0; from < MAX_PRODUCTS; from += PAGE) {
    const { data, error } = await supabaseAdmin
      .from("products")
      .select(
        "id, title, status, product_variants(id, price, main_image_url, stock_qty, continue_selling_out_of_stock, option1_value, option2_value, option3_value)",
      )
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    for (const { product_variants, ...p } of data ?? []) {
      products.push({ ...p, variants: product_variants ?? [] });
    }
    if ((data?.length ?? 0) < PAGE) break;
  }
  return products;
}

/** An opaque, per-store handle for a customer, so the customer list and its
 *  detail request never carry a buyer's account id or phone number in a URL
 *  (and so into logs and browser history). Salted with the store id: the same
 *  buyer gets unrelated keys at two stores. */
export async function customerKey(storeId: string, identity: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${storeId}\u0000${identity}`),
  );
  return Array.from(new Uint8Array(digest).slice(0, 12), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

/** The customer list as the client sees it: grouped by deriveCustomers, with
 *  the internal identity (which holds an account id or a phone number)
 *  swapped for an opaque key. `orderIds` stays server-side. */
export async function buildCustomerRows(
  storeId: string,
  orders: InsightOrder[],
): Promise<(CustomerRow & { orderIds: string[] })[]> {
  const customers = deriveCustomers(orders);
  const accountIds = orders.flatMap((o) => (o.buyer_id ? [o.buyer_id] : []));
  const profiles = await loadBuyerProfiles(accountIds);
  return Promise.all(
    customers.map(async ({ identity, ...c }) => {
      const profile = c.isAccount ? profiles.get(identity.slice("account:".length)) : undefined;
      return {
        ...c,
        key: await customerKey(storeId, identity),
        username: profile?.username ?? null,
        avatarUrl: profile?.avatarUrl ?? null,
      };
    }),
  );
}

export type BuyerProfile = { username: string | null; avatarUrl: string | null };

/** Public profile bits for account buyers: the @username and picture anyone
 *  can already see on their profile. Never their email or personal phone. */
export async function loadBuyerProfiles(buyerIds: string[]): Promise<Map<string, BuyerProfile>> {
  const out = new Map<string, BuyerProfile>();
  const ids = [...new Set(buyerIds)];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, personal_username, avatar_url")
      .in("id", ids.slice(i, i + 200));
    if (error) {
      // Names still come from the orders; a missing @username is cosmetic.
      console.error("insights: buyer profiles lookup failed", error);
      return out;
    }
    for (const p of data ?? []) {
      out.set(p.id, { username: p.personal_username, avatarUrl: p.avatar_url });
    }
  }
  return out;
}
