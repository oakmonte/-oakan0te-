// The arithmetic behind seller insights: the dashboard's sales chart and the
// Customers, Growth and Content screens.
//
// Pure functions over rows the server has already scoped to one store, so the
// money rules can be unit-tested without a database and the same file can be
// imported by the screens for formatting. Nothing here decides WHICH rows a
// seller may see -- that is the api.store.insights.* handlers' job.
//
// Revenue everywhere is the order's items total in kobo: what the pieces sold
// for. Delivery is left out (it is the courier's money, not the seller's), and
// so are fees, which are not recorded per order until Paystack splits go live.

export const PAID_STATUSES = ["paid", "shipped", "delivered"] as const;

export function isPaidStatus(status: string): boolean {
  return (PAID_STATUSES as readonly string[]).includes(status);
}

// --- Periods ------------------------------------------------------------------

export type Period = "7d" | "30d" | "90d";

export const PERIODS: { value: Period; short: string; label: string }[] = [
  { value: "7d", short: "7D", label: "Last 7 days" },
  { value: "30d", short: "30D", label: "Last 30 days" },
  { value: "90d", short: "90D", label: "Last 90 days" },
];

// 90 daily bars are a barcode on a 375px phone, so 90D groups by week.
const PERIOD_SPEC: Record<Period, { days: number; bucketDays: number }> = {
  "7d": { days: 7, bucketDays: 1 },
  "30d": { days: 30, bucketDays: 1 },
  "90d": { days: 90, bucketDays: 7 },
};

export function parsePeriod(value: unknown, fallback: Period = "30d"): Period {
  return value === "7d" || value === "30d" || value === "90d" ? value : fallback;
}

export function periodLabel(period: Period): string {
  return PERIODS.find((p) => p.value === period)?.label ?? "";
}

/** West Africa Time. Nigeria has no daylight saving, so a fixed offset is
 *  exact there; the browser sends its own offset and this is only the default
 *  for a request that didn't. */
export const DEFAULT_TZ_OFFSET_MINUTES = 60;

/** Minutes EAST of UTC (the opposite sign to Date#getTimezoneOffset). Clamped
 *  to the real-world range so a junk value can't shift days by a week. */
export function parseTzOffset(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  if (!Number.isFinite(n)) return DEFAULT_TZ_OFFSET_MINUTES;
  return Math.max(-720, Math.min(840, Math.round(n)));
}

const DAY_MS = 86_400_000;

/** UTC instant at which the seller's local day containing `ms` began. Days are
 *  bucketed in the seller's time, not the server's: an order at 00:30 in Lagos
 *  is still "yesterday" in UTC. */
function localDayStart(ms: number, tz: number): number {
  const offset = tz * 60_000;
  return Math.floor((ms + offset) / DAY_MS) * DAY_MS - offset;
}

/** The seller's local calendar date at `ms`, as YYYY-MM-DD. */
export function localDateKey(ms: number, tz: number): string {
  return new Date(ms + tz * 60_000).toISOString().slice(0, 10);
}

export type TimeWindow = { startMs: number; endMs: number };

/** The current period (today and the days before it) and the equally long
 *  period immediately before it, for the comparison. End is exclusive. */
export function periodWindows(
  period: Period,
  now: Date,
  tz: number,
): { current: TimeWindow; previous: TimeWindow } {
  const { days } = PERIOD_SPEC[period];
  const todayStart = localDayStart(now.getTime(), tz);
  const startMs = todayStart - (days - 1) * DAY_MS;
  return {
    current: { startMs, endMs: todayStart + DAY_MS },
    previous: { startMs: startMs - days * DAY_MS, endMs: startMs },
  };
}

// --- Rows -----------------------------------------------------------------------

export type InsightOrderItem = {
  product_id: string | null;
  title: string;
  image_url: string | null;
  unit_price_kobo: number;
  quantity: number;
};

/** A paid order of one store, as the insights handlers load it. */
export type InsightOrder = {
  id: string;
  created_at: string;
  status: string;
  items_total_kobo: number;
  buyer_id: string | null;
  guest_email: string | null;
  ship_to: unknown;
  items: InsightOrderItem[];
};

const ms = (iso: string) => new Date(iso).getTime();

function inWindow(order: InsightOrder, w: TimeWindow): boolean {
  const t = ms(order.created_at);
  return t >= w.startMs && t < w.endMs;
}

// --- Sales ----------------------------------------------------------------------

export type SalesTotals = {
  revenueKobo: number;
  orders: number;
  units: number;
  /** Average order value, rounded to the kobo. 0 when there are no orders. */
  aovKobo: number;
};

export function summarize(orders: InsightOrder[]): SalesTotals {
  let revenueKobo = 0;
  let units = 0;
  for (const o of orders) {
    revenueKobo += o.items_total_kobo;
    for (const it of o.items) units += it.quantity;
  }
  return {
    revenueKobo,
    orders: orders.length,
    units,
    aovKobo: orders.length ? Math.round(revenueKobo / orders.length) : 0,
  };
}

export type SalesBucket = {
  /** First and last local dates the bar covers, inclusive. Equal for a day. */
  start: string;
  end: string;
  revenueKobo: number;
  orders: number;
};

export type SalesSeries = {
  buckets: SalesBucket[];
  totals: SalesTotals;
  previous: { revenueKobo: number; orders: number };
};

/** Bars for the chart plus the period's totals. Every bucket is present, empty
 *  ones included, so a quiet Tuesday is a visible gap rather than a missing
 *  day the axis silently skips. */
export function buildSalesSeries(
  orders: InsightOrder[],
  period: Period,
  now: Date,
  tz: number,
): SalesSeries {
  const { days, bucketDays } = PERIOD_SPEC[period];
  const { current, previous } = periodWindows(period, now, tz);
  // Buckets are aligned to TODAY, so the newest bar is always a whole week on
  // 90D and any short remainder lands on the oldest bar instead.
  const n = Math.ceil(days / bucketDays);

  const buckets: SalesBucket[] = Array.from({ length: n }, (_, i) => {
    const firstDay = Math.max(0, days - (n - i) * bucketDays);
    const lastDay = days - (n - i - 1) * bucketDays - 1;
    return {
      start: localDateKey(current.startMs + firstDay * DAY_MS, tz),
      end: localDateKey(current.startMs + lastDay * DAY_MS, tz),
      revenueKobo: 0,
      orders: 0,
    };
  });

  const inCurrent: InsightOrder[] = [];
  let prevRevenue = 0;
  let prevOrders = 0;
  for (const o of orders) {
    if (inWindow(o, current)) {
      inCurrent.push(o);
      const dayIndex = Math.floor((ms(o.created_at) - current.startMs) / DAY_MS);
      const b = buckets[n - 1 - Math.floor((days - 1 - dayIndex) / bucketDays)];
      b.revenueKobo += o.items_total_kobo;
      b.orders += 1;
    } else if (inWindow(o, previous)) {
      prevRevenue += o.items_total_kobo;
      prevOrders += 1;
    }
  }

  return {
    buckets,
    totals: summarize(inCurrent),
    previous: { revenueKobo: prevRevenue, orders: prevOrders },
  };
}

/** Whole-percent change, or null when there is nothing to compare against --
 *  "up from zero" has no honest percentage. */
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

// --- Products sold --------------------------------------------------------------

export type ProductSales = {
  /** product_id, or the title for a line whose product has since been deleted. */
  key: string;
  productId: string | null;
  title: string;
  imageUrl: string | null;
  units: number;
  revenueKobo: number;
  orders: number;
};

/** Units and revenue per product. Title and picture come from the newest sale,
 *  which is the snapshot closest to how the product looks now. */
export function aggregateProducts(orders: InsightOrder[]): ProductSales[] {
  const map = new Map<string, ProductSales & { latest: number; seenIn: Set<string> }>();
  for (const o of orders) {
    const t = ms(o.created_at);
    for (const it of o.items) {
      const key = it.product_id ?? `title:${it.title}`;
      let row = map.get(key);
      if (!row) {
        row = {
          key,
          productId: it.product_id,
          title: it.title,
          imageUrl: it.image_url,
          units: 0,
          revenueKobo: 0,
          orders: 0,
          latest: t,
          seenIn: new Set(),
        };
        map.set(key, row);
      }
      row.units += it.quantity;
      row.revenueKobo += it.unit_price_kobo * it.quantity;
      if (!row.seenIn.has(o.id)) {
        row.seenIn.add(o.id);
        row.orders += 1;
      }
      if (t > row.latest) {
        row.latest = t;
        row.title = it.title;
        row.imageUrl = it.image_url ?? row.imageUrl;
      }
    }
  }
  return [...map.values()].map(({ latest: _l, seenIn: _s, ...rest }) => rest);
}

export function rankProducts(
  rows: ProductSales[],
  by: "units" | "revenue",
  limit: number,
): ProductSales[] {
  const primary = (r: ProductSales) => (by === "units" ? r.units : r.revenueKobo);
  const secondary = (r: ProductSales) => (by === "units" ? r.revenueKobo : r.units);
  return [...rows]
    .sort(
      (a, b) =>
        primary(b) - primary(a) || secondary(b) - secondary(a) || a.title.localeCompare(b.title),
    )
    .slice(0, limit);
}

// --- Customers ------------------------------------------------------------------

export type ShipTo = { name: string | null; phone: string | null; address: string | null };

/** ship_to is a JSON snapshot written at checkout; read it defensively, since
 *  nothing at the database level guarantees its shape. */
export function readShipTo(value: unknown): ShipTo {
  const o = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  return { name: s(o.name), phone: s(o.phone), address: s(o.address) };
}

const digits = (s: string) => s.replace(/\D/g, "");

/** The last ten digits of a phone number: Nigeria's national number, so
 *  0803 123 4567, +234 803 123 4567 and 2348031234567 are one buyer. Null
 *  for anything too short to be a phone number at all. */
export function phoneKey(phone: string | null): string | null {
  if (!phone) return null;
  const d = digits(phone);
  return d.length >= 7 ? d.slice(-10) : null;
}

/** Who placed an order, as a grouping key. Signed-in buyers group by account;
 *  guests by phone (always collected for delivery), then email, and failing
 *  both an order stands alone rather than being merged with a stranger's. */
export function customerIdentity(order: InsightOrder): string {
  if (order.buyer_id) return `account:${order.buyer_id}`;
  const phone = phoneKey(readShipTo(order.ship_to).phone);
  if (phone) return `phone:${phone}`;
  const email = order.guest_email?.trim().toLowerCase();
  if (email) return `email:${email}`;
  return `order:${order.id}`;
}

export type CustomerSummary = {
  identity: string;
  isAccount: boolean;
  name: string | null;
  phone: string | null;
  email: string | null;
  orders: number;
  totalKobo: number;
  firstOrderAt: string;
  lastOrderAt: string;
  orderIds: string[];
};

/** One row per buyer, most recent first. Contact details come from the
 *  newest order that has them -- a buyer who moved gets their new address. */
export function deriveCustomers(orders: InsightOrder[]): CustomerSummary[] {
  const newestFirst = [...orders].sort((a, b) => ms(b.created_at) - ms(a.created_at));
  const map = new Map<string, CustomerSummary>();
  for (const o of newestFirst) {
    const identity = customerIdentity(o);
    const ship = readShipTo(o.ship_to);
    let c = map.get(identity);
    if (!c) {
      c = {
        identity,
        isAccount: !!o.buyer_id,
        name: null,
        phone: null,
        email: null,
        orders: 0,
        totalKobo: 0,
        firstOrderAt: o.created_at,
        lastOrderAt: o.created_at,
        orderIds: [],
      };
      map.set(identity, c);
    }
    c.orders += 1;
    c.totalKobo += o.items_total_kobo;
    c.firstOrderAt = o.created_at; // walking newest to oldest
    c.orderIds.push(o.id);
    c.name ??= ship.name;
    c.phone ??= ship.phone;
    c.email ??= o.guest_email?.trim() || null;
  }
  return [...map.values()];
}

/** Client-side search over the customer list: name, email, @username, or any
 *  run of the phone number however it was typed (0803..., +234 803...). */
export function matchesCustomer(
  c: { name: string | null; phone: string | null; email: string | null; username?: string | null },
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const text = q.replace(/^@/, "");
  if (c.name?.toLowerCase().includes(text)) return true;
  if (c.email?.toLowerCase().includes(text)) return true;
  if (c.username?.toLowerCase().includes(text)) return true;

  const qd = digits(q);
  if (qd.length < 3 || !c.phone) return false;
  const pd = digits(c.phone);
  // Compare national numbers, so a local 0-prefix and a 234 prefix both match.
  const national = qd.replace(/^234/, "").replace(/^0/, "");
  return pd.includes(qd) || (national.length >= 3 && pd.includes(national));
}

/** The number wa.me expects (country code, no +), or null when it can't be
 *  worked out. Bare local numbers are assumed Nigerian, which is who checks
 *  out today; anything else must already carry its country code. */
export function whatsappNumber(phone: string | null): string | null {
  if (!phone) return null;
  const d = digits(phone);
  if (/^234\d{10}$/.test(d)) return d;
  if (/^0[789]\d{9}$/.test(d)) return `234${d.slice(1)}`;
  if (/^[789]\d{9}$/.test(d)) return `234${d}`;
  if (phone.trim().startsWith("+") && d.length >= 8 && d.length <= 15) return d;
  return null;
}

// --- Catalogue health -------------------------------------------------------------

export type CatalogVariant = {
  id: string;
  price: number | null;
  main_image_url: string | null;
  stock_qty: number | null;
  continue_selling_out_of_stock: boolean;
  option1_value: string | null;
  option2_value: string | null;
  option3_value: string | null;
};

export type CatalogProduct = {
  id: string;
  title: string | null;
  status: string;
  variants: CatalogVariant[];
};

export const LOW_STOCK_THRESHOLD = 3;

export type LowStockRow = {
  productId: string;
  variantId: string;
  title: string;
  variantLabel: string | null;
  imageUrl: string | null;
  /** Null when no count was ever entered -- which checkout treats as zero. */
  stockQty: number | null;
};

const variantLabel = (v: CatalogVariant) =>
  [v.option1_value, v.option2_value, v.option3_value].filter(Boolean).join(" / ") || null;

const productImage = (p: CatalogProduct) =>
  p.variants.find((v) => v.main_image_url?.trim())?.main_image_url ?? null;

/** Live variants a buyer is about to be unable to buy. A variant set to keep
 *  selling past zero is never low; a variant with no count at all is listed,
 *  because checkout refuses it exactly as it refuses a zero. */
export function lowStock(
  products: CatalogProduct[],
  threshold = LOW_STOCK_THRESHOLD,
): LowStockRow[] {
  const rows: LowStockRow[] = [];
  for (const p of products) {
    if (p.status !== "active") continue;
    for (const v of p.variants) {
      if (v.continue_selling_out_of_stock) continue;
      if (v.stock_qty !== null && v.stock_qty > threshold) continue;
      rows.push({
        productId: p.id,
        variantId: v.id,
        title: p.title?.trim() || "Untitled piece",
        variantLabel: variantLabel(v),
        imageUrl: v.main_image_url ?? productImage(p),
        stockQty: v.stock_qty,
      });
    }
  }
  return rows.sort(
    (a, b) => (a.stockQty ?? -1) - (b.stockQty ?? -1) || a.title.localeCompare(b.title),
  );
}

export type FixRow = {
  productId: string;
  title: string;
  imageUrl: string | null;
  missing: ("photo" | "price")[];
};

/** Products a buyer can't properly see or pay for: no photo anywhere, or a
 *  variant with no price. Archived products are the seller's business. */
export function productsNeedingFixes(products: CatalogProduct[]): FixRow[] {
  const rows: FixRow[] = [];
  for (const p of products) {
    if (p.status === "archived") continue;
    const missing: FixRow["missing"] = [];
    if (!productImage(p)) missing.push("photo");
    if (p.variants.length === 0 || p.variants.some((v) => v.price == null || v.price <= 0)) {
      missing.push("price");
    }
    if (missing.length) {
      rows.push({
        productId: p.id,
        title: p.title?.trim() || "Untitled piece",
        imageUrl: productImage(p),
        missing,
      });
    }
  }
  return rows;
}

// --- Growth checklist --------------------------------------------------------------

export type GrowthSignals = {
  activeProducts: number;
  productsMissingPhoto: number;
  productsMissingPrice: number;
  lowStockCount: number;
  publishedPosts: number;
  postsLinkingProducts: number;
  lastPostAt: string | null;
  paidOrders: number;
  repeatCustomers: number;
};

export type GrowthAction = {
  id: string;
  title: string;
  detail: string;
  done: boolean;
  cta: string;
  target:
    | { kind: "link"; to: "/store/products/new" | "/store/products" | "/create" | "/store/customers" }
    | { kind: "scroll"; section: "share" | "fix" | "stock" };
};

export const MIN_CATALOGUE = 5;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Next steps derived from the store's real numbers. Unfinished ones first,
 *  in the order that most moves sales; each says what was measured. */
export function growthChecklist(s: GrowthSignals, now: Date): GrowthAction[] {
  const daysSincePost = s.lastPostAt
    ? Math.floor((now.getTime() - ms(s.lastPostAt)) / DAY_MS)
    : null;
  const hasProducts = s.activeProducts > 0;

  const actions: GrowthAction[] = [
    {
      id: "catalogue",
      title: `List at least ${MIN_CATALOGUE} pieces`,
      detail:
        s.activeProducts >= MIN_CATALOGUE
          ? `${plural(s.activeProducts, "piece")} live.`
          : `${s.activeProducts} of ${MIN_CATALOGUE} live. More pieces, more reasons to buy.`,
      done: s.activeProducts >= MIN_CATALOGUE,
      cta: "Add a piece",
      target: { kind: "link", to: "/store/products/new" },
    },
    {
      id: "photos",
      title: "Every piece has a photo",
      detail: !hasProducts
        ? "Nothing listed yet."
        : s.productsMissingPhoto
          ? `${plural(s.productsMissingPhoto, "piece")} without one. Buyers scroll past those.`
          : "All your pieces have photos.",
      done: hasProducts && s.productsMissingPhoto === 0,
      cta: "Fix them",
      target: { kind: "scroll", section: "fix" },
    },
    {
      id: "prices",
      title: "Every piece has a price",
      detail: !hasProducts
        ? "Nothing listed yet."
        : s.productsMissingPrice
          ? `${plural(s.productsMissingPrice, "piece")} can't be bought until priced.`
          : "Everything is priced.",
      done: hasProducts && s.productsMissingPrice === 0,
      cta: "Fix them",
      target: { kind: "scroll", section: "fix" },
    },
    {
      id: "first-post",
      title: "Post your first piece",
      detail: s.publishedPosts
        ? `${plural(s.publishedPosts, "post")} published.`
        : "Posts are how shoppers find you in Explore.",
      done: s.publishedPosts > 0,
      cta: "Create a post",
      target: { kind: "link", to: "/create" },
    },
    {
      id: "link-products",
      title: "Link pieces in a post",
      detail: s.postsLinkingProducts
        ? `${plural(s.postsLinkingProducts, "post")} link your pieces.`
        : "A linked post lets viewers buy straight from it.",
      done: s.postsLinkingProducts > 0,
      cta: "Create a post",
      target: { kind: "link", to: "/create" },
    },
    {
      id: "post-weekly",
      title: "Post this week",
      detail:
        daysSincePost === null
          ? "No posts yet."
          : daysSincePost === 0
            ? "You posted today."
            : `Last post ${plural(daysSincePost, "day")} ago.`,
      done: daysSincePost !== null && daysSincePost < 7,
      cta: "Create a post",
      target: { kind: "link", to: "/create" },
    },
    {
      id: "first-order",
      title: "Get your first order",
      detail: s.paidOrders
        ? `${plural(s.paidOrders, "paid order")} so far.`
        : "Share your store link on your WhatsApp status.",
      done: s.paidOrders > 0,
      cta: "Share your link",
      target: { kind: "scroll", section: "share" },
    },
    {
      id: "repeat",
      title: "Win a repeat customer",
      detail: s.repeatCustomers
        ? `${plural(s.repeatCustomers, "customer")} came back.`
        : "Message past buyers when something new lands.",
      done: s.repeatCustomers > 0,
      cta: "See customers",
      target: { kind: "link", to: "/store/customers" },
    },
    {
      id: "stock",
      title: "Keep stock topped up",
      detail: s.lowStockCount
        ? `${plural(s.lowStockCount, "size or colour", "sizes or colours")} low or out.`
        : "Nothing is running low.",
      done: hasProducts && s.lowStockCount === 0,
      cta: "See what's low",
      target: { kind: "scroll", section: "stock" },
    },
  ];

  // Stable sort: unfinished first, each group keeping the order above.
  return [...actions.filter((a) => !a.done), ...actions.filter((a) => a.done)];
}

// --- Content attribution -------------------------------------------------------------

export type PostLinks = { id: string; created_at: string; productIds: string[] };

export type PostAttribution = { orders: number; units: number; revenueKobo: number };

/** Paid orders that include a piece a post links, placed after the post went
 *  up and inside the window. A signal, not proof: nothing records which post a
 *  buyer came from, and one order can count toward several posts. Only the
 *  linked lines count toward units and revenue, not the whole basket. */
export function attributeToPosts(
  posts: PostLinks[],
  orders: InsightOrder[],
  window: TimeWindow,
): Record<string, PostAttribution> {
  const out: Record<string, PostAttribution> = {};
  for (const post of posts) {
    const linked = new Set(post.productIds);
    const from = Math.max(window.startMs, ms(post.created_at));
    const result: PostAttribution = { orders: 0, units: 0, revenueKobo: 0 };
    if (linked.size) {
      for (const o of orders) {
        const t = ms(o.created_at);
        if (t < from || t >= window.endMs) continue;
        const lines = o.items.filter((it) => it.product_id && linked.has(it.product_id));
        if (!lines.length) continue;
        result.orders += 1;
        for (const it of lines) {
          result.units += it.quantity;
          result.revenueKobo += it.unit_price_kobo * it.quantity;
        }
      }
    }
    out[post.id] = result;
  }
  return out;
}

/** The same signal summed across all posts without double counting: each
 *  order once, each order line once, however many posts link it. */
export function attributionTotals(
  posts: PostLinks[],
  orders: InsightOrder[],
  window: TimeWindow,
): PostAttribution {
  // For each product, the earliest moment any post linked it.
  const linkedSince = new Map<string, number>();
  for (const post of posts) {
    const t = ms(post.created_at);
    for (const id of post.productIds) {
      const prev = linkedSince.get(id);
      if (prev === undefined || t < prev) linkedSince.set(id, t);
    }
  }
  const total: PostAttribution = { orders: 0, units: 0, revenueKobo: 0 };
  for (const o of orders) {
    const t = ms(o.created_at);
    if (t < window.startMs || t >= window.endMs) continue;
    const lines = o.items.filter((it) => {
      const since = it.product_id ? linkedSince.get(it.product_id) : undefined;
      return since !== undefined && t >= since;
    });
    if (!lines.length) continue;
    total.orders += 1;
    for (const it of lines) {
      total.units += it.quantity;
      total.revenueKobo += it.unit_price_kobo * it.quantity;
    }
  }
  return total;
}

// --- Formatting -------------------------------------------------------------------

/** ₦12,500 -- kobo shown only when there are some. */
export function formatKobo(kobo: number): string {
  const naira = kobo / 100;
  return `₦${naira.toLocaleString("en-US", {
    minimumFractionDigits: Number.isInteger(naira) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Short form for chart axes: ₦950, ₦12.5k, ₦1.2m. */
export function formatKoboCompact(kobo: number): string {
  const naira = kobo / 100;
  const trim = (n: number) => String(Math.round(n * 10) / 10);
  if (Math.abs(naira) >= 1_000_000) return `₦${trim(naira / 1_000_000)}m`;
  if (Math.abs(naira) >= 1_000) return `₦${trim(naira / 1_000)}k`;
  return `₦${Math.round(naira)}`;
}

/** The smallest "round" number (1, 2 or 5 times a power of ten) at or above
 *  `n`, for the chart's top gridline. No 2.5 step: the chart also labels the
 *  halfway line, and half of 2.5k is 1.25k, which no axis label shows cleanly. */
export function niceCeil(n: number): number {
  if (n <= 0) return 0;
  const pow = 10 ** Math.floor(Math.log10(n));
  for (const step of [1, 2, 5, 10]) {
    if (step * pow >= n) return step * pow;
  }
  return 10 * pow;
}

/** "6 Oct" for a date this year, "6 Oct 2025" for an older one, in the
 *  viewer's own timezone (it is their order history they are reading). */
export function formatDate(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: d.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

/** "6 Oct" for a YYYY-MM-DD local date key. */
export function formatDayKey(key: string): string {
  return new Date(`${key}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** "6 Oct" or "30 Sep - 6 Oct" for a bucket. */
export function formatBucketRange(b: { start: string; end: string }): string {
  return b.start === b.end
    ? formatDayKey(b.start)
    : `${formatDayKey(b.start)} – ${formatDayKey(b.end)}`;
}

// --- API shapes -------------------------------------------------------------------
// What each api.store.insights.* handler returns. Declared here, beside the
// arithmetic, so the handlers and the screens are checked against one shape.

export type SalesResponse = SalesSeries & {
  period: Period;
  bestSellers: ProductSales[];
  allTime: { orders: number; revenueKobo: number; customers: number };
  truncated: boolean;
};

export type CustomerRow = {
  /** Opaque and per-store; see customerKey in insights.server.ts. */
  key: string;
  isAccount: boolean;
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
  phone: string | null;
  email: string | null;
  orders: number;
  totalKobo: number;
  firstOrderAt: string;
  lastOrderAt: string;
};

export type CustomersResponse = {
  customers: CustomerRow[];
  summary: { customers: number; repeat: number; totalKobo: number };
  truncated: boolean;
};

export type CustomerOrder = {
  id: string;
  status: string;
  created_at: string;
  items_total_kobo: number;
  delivery_fee_kobo: number;
  total_kobo: number;
  courier_name: string | null;
  tracking_url: string | null;
  items: {
    product_id: string | null;
    title: string;
    variant_label: string | null;
    image_url: string | null;
    unit_price_kobo: number;
    quantity: number;
  }[];
};

export type CustomerDetailResponse = {
  customer: CustomerRow & { address: string | null; whatsapp: string | null };
  orders: CustomerOrder[];
  /** Orders beyond the ones returned, for a "and N earlier" line. */
  moreOrders: number;
};

export type GrowthResponse = {
  signals: GrowthSignals;
  checklist: GrowthAction[];
  topByRevenue: ProductSales[];
  topByUnits: ProductSales[];
  lowStock: LowStockRow[];
  needsFixing: FixRow[];
  /** Before the list was cut to fit the screen; lowStock's is in signals. */
  needsFixingTotal: number;
  truncated: boolean;
};

export type ContentProduct = {
  id: string;
  title: string;
  imageUrl: string | null;
  /** The cheapest priced variant, in kobo; null when none is priced. */
  priceKobo: number | null;
  status: string;
};

export type ContentPost = {
  id: string;
  caption: string | null;
  mediaType: string;
  mediaUrl: string;
  thumbnailUrl: string | null;
  createdWith: string | null;
  visibility: string;
  createdAt: string;
  products: ContentProduct[];
  attribution: PostAttribution;
};

export type ContentResponse = {
  period: Period;
  posts: ContentPost[];
  totals: PostAttribution & { published: number; shown: number; linkedPosts: number };
  truncated: boolean;
};
