/**
 * The activity centre's data model: what /api/activity derives from existing
 * tables, and the rules the screen and the bell read it by.
 *
 * Pure on purpose -- no Supabase, no React, no storage -- so the server route
 * (api.activity.ts) and the client (activity.ts, routes/activity.tsx) share one
 * definition of an item, and the derivation rules are unit-tested directly
 * rather than through a database.
 *
 * Nothing here is stored as a notification. Every item is read back from the
 * table that already holds the truth (follows, orders + order_payments, the
 * chat inbox), so it cannot drift out of step with it. Likes, comments and
 * mentions are not persisted anywhere yet; their future table is written but
 * not applied (supabase/migrations/20261008121000_activity_notifications.sql).
 */

export type ActivityFilter = "all" | "orders" | "followers" | "messages";

export const ACTIVITY_FILTERS: { key: ActivityFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "orders", label: "Orders" },
  { key: "followers", label: "Followers" },
  { key: "messages", label: "Messages" },
];

export type ActivityPerson = {
  id: string;
  /** Null for an account that never picked a username: no profile to link to. */
  username: string | null;
  name: string;
  avatarUrl: string | null;
};

/** The statuses a buyer hears about. awaiting_payment / awaiting_acceptance
 *  are left out: the buyer is the one who just did that, it isn't news. */
export const BUYER_STATUSES = ["paid", "shipped", "delivered", "declined", "cancelled"] as const;
export type BuyerOrderStatus = (typeof BUYER_STATUSES)[number];

/** The statuses a seller's orders can be in once there's something to act on.
 *  Same set /store/orders lists: an unpaid order isn't the seller's business yet. */
export const SELLER_STATUSES = ["paid", "shipped", "delivered"] as const;

type OrderSummary = {
  orderId: string;
  totalKobo: number;
  /** One line's title, standing in for the order. */
  title: string;
  /** How many distinct lines the order has, for "+2 more". */
  lineCount: number;
  imageUrl: string | null;
};

export type ActivityItem =
  | {
      kind: "follow";
      key: string;
      at: string;
      person: ActivityPerson;
      /** Whether the viewer already follows them back. */
      followingBack: boolean;
    }
  | ({
      kind: "store-order";
      key: string;
      at: string;
      /** paid = a new order to ship; delivered = the courier finished it. */
      event: "paid" | "delivered";
      buyerName: string | null;
      /** Still waiting on the seller to ship, as of this load. The "new
       *  order" item outlives that, so its nudge has to know. */
      toShip: boolean;
    } & OrderSummary)
  | ({
      kind: "my-order";
      key: string;
      at: string;
      status: BuyerOrderStatus;
      storeName: string | null;
    } & OrderSummary)
  | {
      kind: "messages";
      key: string;
      at: string;
      conversationId: string;
      person: ActivityPerson;
      unreadCount: number;
    };

/** A part of the feed that failed to load. The rest still renders; the screen
 *  names what is missing instead of pretending it's empty. */
export type ActivitySource = "followers" | "orders" | "store-orders" | "messages";

export type ActivityFeed = {
  items: ActivityItem[];
  /** Owns a store, so the seller copy ("No orders yet" etc.) applies. */
  isSeller: boolean;
  unavailable: ActivitySource[];
};

export const SOURCE_LABEL: Record<ActivitySource, string> = {
  followers: "followers",
  orders: "your orders",
  "store-orders": "store orders",
  messages: "messages",
};

/** Which sources feed a tab, so a failure is only reported where it matters:
 *  the inbox failing says nothing about the Followers tab. */
export function sourcesForFilter(filter: ActivityFilter): ActivitySource[] {
  switch (filter) {
    case "followers":
      return ["followers"];
    case "messages":
      return ["messages"];
    case "orders":
      return ["orders", "store-orders"];
    default:
      return ["followers", "orders", "store-orders", "messages"];
  }
}

/** Most items the feed returns in total. Older than this is history, not activity. */
export const FEED_LIMIT = 150;

/* ---------- builders (server side, from raw rows) ---------- */

export type FollowRow = { follower_id: string; created_at: string };

export type ProfileRow = {
  id: string | null;
  personal_username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export function personFrom(profile: ProfileRow): ActivityPerson | null {
  if (!profile.id) return null;
  const username = profile.personal_username || null;
  const name = profile.display_name?.trim() || (username ? `@${username}` : "Oakmonte member");
  return { id: profile.id, username, name, avatarUrl: profile.avatar_url || null };
}

/** One item per follower. Someone the viewer has blocked is left out, and so
 *  is a follower with no public profile row: an item that can't say who it is
 *  only makes the reader wonder. */
export function buildFollowItems(input: {
  me: string;
  follows: FollowRow[];
  profiles: ProfileRow[];
  iFollow: Iterable<string>;
  blocked: Iterable<string>;
}): ActivityItem[] {
  const byId = new Map<string, ActivityPerson>();
  for (const row of input.profiles) {
    const person = personFrom(row);
    if (person) byId.set(person.id, person);
  }
  const following = new Set(input.iFollow);
  const blocked = new Set(input.blocked);
  const items: ActivityItem[] = [];
  for (const row of input.follows) {
    if (row.follower_id === input.me || blocked.has(row.follower_id)) continue;
    const person = byId.get(row.follower_id);
    if (!person) continue;
    items.push({
      kind: "follow",
      key: `follow:${row.follower_id}`,
      at: row.created_at,
      person,
      followingBack: following.has(row.follower_id),
    });
  }
  return items;
}

export type OrderLineRow = {
  order_id: string;
  title: string;
  image_url: string | null;
};

/** One line stands in for the whole order. order_items has no position
 *  column, so the line is picked by title, not by whatever order the database
 *  returned -- otherwise the same order could show a different piece on every
 *  refresh. A line with a photo wins, so the thumbnail isn't blank when it
 *  doesn't have to be. */
export function summariseLines(
  lines: OrderLineRow[],
): Map<string, { title: string; lineCount: number; imageUrl: string | null }> {
  const grouped = new Map<string, OrderLineRow[]>();
  for (const line of lines) {
    const list = grouped.get(line.order_id);
    if (list) list.push(line);
    else grouped.set(line.order_id, [line]);
  }
  const out = new Map<string, { title: string; lineCount: number; imageUrl: string | null }>();
  for (const [orderId, list] of grouped) {
    const sorted = [...list].sort((a, b) => a.title.localeCompare(b.title));
    const lead = sorted.find((line) => line.image_url) ?? sorted[0];
    out.set(orderId, {
      title: lead.title,
      lineCount: list.length,
      imageUrl: lead.image_url || null,
    });
  }
  return out;
}

export type BuyerOrderRow = {
  id: string;
  status: string;
  store_id: string;
  total_kobo: number;
  updated_at: string;
};

/** One item per order, at its current status. orders keeps no per-status
 *  timestamps, only updated_at (stamped on every status change), so "shipped"
 *  is gone once the order is delivered -- the latest state is what's true. */
export function buildBuyerOrderItems(input: {
  orders: BuyerOrderRow[];
  lines: OrderLineRow[];
  storeNames: Map<string, string>;
}): ActivityItem[] {
  const summaries = summariseLines(input.lines);
  const items: ActivityItem[] = [];
  for (const order of input.orders) {
    if (!(BUYER_STATUSES as readonly string[]).includes(order.status)) continue;
    const summary = summaries.get(order.id);
    items.push({
      kind: "my-order",
      key: `order:${order.id}:${order.status}`,
      at: order.updated_at,
      orderId: order.id,
      status: order.status as BuyerOrderStatus,
      storeName: input.storeNames.get(order.store_id) ?? null,
      totalKobo: order.total_kobo,
      title: summary?.title ?? "Your order",
      lineCount: summary?.lineCount ?? 0,
      imageUrl: summary?.imageUrl ?? null,
    });
  }
  return items;
}

export type SellerOrderRow = {
  id: string;
  status: string;
  total_kobo: number;
  ship_to: unknown;
  updated_at: string;
};

export type PaymentRow = { order_id: string; confirmed_at: string | null };

function buyerNameOf(shipTo: unknown): string | null {
  if (!shipTo || typeof shipTo !== "object") return null;
  const name = (shipTo as { name?: unknown }).name;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

/** Up to two items per order: the new order itself, dated by when the payment
 *  was confirmed (so it survives the order moving on to shipped), and the
 *  delivery once it lands. "Shipped" is left out -- the seller booked it. */
export function buildSellerOrderItems(input: {
  orders: SellerOrderRow[];
  payments: PaymentRow[];
  lines: OrderLineRow[];
}): ActivityItem[] {
  const summaries = summariseLines(input.lines);
  const paidAt = new Map<string, string>();
  for (const payment of input.payments) {
    if (!payment.confirmed_at) continue;
    const existing = paidAt.get(payment.order_id);
    // A webhook replay can't make two confirmed rows (unique reference), but a
    // second payment method could. The first confirmation is when it was new.
    if (!existing || payment.confirmed_at < existing) {
      paidAt.set(payment.order_id, payment.confirmed_at);
    }
  }

  const items: ActivityItem[] = [];
  for (const order of input.orders) {
    if (!(SELLER_STATUSES as readonly string[]).includes(order.status)) continue;
    const summary = summaries.get(order.id);
    const base = {
      orderId: order.id,
      totalKobo: order.total_kobo,
      title: summary?.title ?? "Order",
      lineCount: summary?.lineCount ?? 0,
      imageUrl: summary?.imageUrl ?? null,
      buyerName: buyerNameOf(order.ship_to),
      toShip: order.status === "paid",
    };
    // Still "paid" means nothing has happened since the payment, so
    // updated_at is the payment time when there's no confirmation row to read.
    const newAt = paidAt.get(order.id) ?? (order.status === "paid" ? order.updated_at : null);
    if (newAt) {
      items.push({
        kind: "store-order",
        key: `store-order:${order.id}:paid`,
        at: newAt,
        event: "paid",
        ...base,
      });
    }
    if (order.status === "delivered") {
      items.push({
        kind: "store-order",
        key: `store-order:${order.id}:delivered`,
        at: order.updated_at,
        event: "delivered",
        ...base,
      });
    }
  }
  return items;
}

export type InboxActivityRow = {
  conversation_id: string;
  kind: string;
  muted: boolean;
  archived_at: string | null;
  blocked_by_me: boolean;
  unread_count: number;
  last_message_at: string;
  last_message_created_at: string | null;
  other_user_id: string | null;
  other_username: string | null;
  other_display_name: string | null;
  other_avatar_url: string | null;
};

/** One item per direct chat with messages the viewer hasn't read.
 *
 *  Narrower than the inbox's own "unread" on purpose: a chat the viewer
 *  marked unread themselves is a reminder they set, not something that
 *  happened to them, and muted or archived chats are ones they asked to stop
 *  hearing about. The Messages screen still shows all of those. */
export function buildMessageItems(rows: InboxActivityRow[]): ActivityItem[] {
  const items: ActivityItem[] = [];
  for (const row of rows) {
    if (row.kind !== "direct" || !row.other_user_id) continue;
    if (row.unread_count <= 0 || row.muted || row.archived_at || row.blocked_by_me) continue;
    const person = personFrom({
      id: row.other_user_id,
      personal_username: row.other_username,
      display_name: row.other_display_name,
      avatar_url: row.other_avatar_url,
    });
    if (!person) continue;
    items.push({
      kind: "messages",
      key: `chat:${row.conversation_id}`,
      at: row.last_message_created_at ?? row.last_message_at,
      conversationId: row.conversation_id,
      person,
      unreadCount: row.unread_count,
    });
  }
  return items;
}

/** Newest first, one entry per key, capped. Ties break on the key so two
 *  items stamped in the same millisecond don't swap places between refreshes. */
export function mergeActivity(lists: ActivityItem[][], limit = FEED_LIMIT): ActivityItem[] {
  const seen = new Set<string>();
  const all: ActivityItem[] = [];
  for (const list of lists) {
    for (const item of list) {
      if (seen.has(item.key)) continue;
      seen.add(item.key);
      all.push(item);
    }
  }
  all.sort((a, b) => {
    const diff = timeOf(b.at) - timeOf(a.at);
    return diff !== 0 ? diff : a.key.localeCompare(b.key);
  });
  return all.slice(0, limit);
}

/* ---------- reading the feed (client side) ---------- */

function timeOf(iso: string): number {
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

export function filterOf(item: ActivityItem): Exclude<ActivityFilter, "all"> {
  switch (item.kind) {
    case "follow":
      return "followers";
    case "messages":
      return "messages";
    default:
      return "orders";
  }
}

export function filterActivity(items: ActivityItem[], filter: ActivityFilter): ActivityItem[] {
  return filter === "all" ? items : items.filter((item) => filterOf(item) === filter);
}

/** New since the viewer last opened the activity centre. Never opened (null)
 *  means everything is new -- it is: none of it has been seen. */
export function isUnseen(item: ActivityItem, lastSeen: number | null): boolean {
  return lastSeen === null || timeOf(item.at) > lastSeen;
}

export function countUnseen(items: ActivityItem[], lastSeen: number | null): number {
  let count = 0;
  for (const item of items) if (isUnseen(item, lastSeen)) count += 1;
  return count;
}

/** What "seen up to" to store after showing these items. The newest item's
 *  own time when that's ahead of the device clock: a phone running a few
 *  minutes slow would otherwise leave the newest item "new" forever. */
export function seenWatermark(items: ActivityItem[], now: number): number {
  let newest = now;
  for (const item of items) newest = Math.max(newest, timeOf(item.at));
  return newest;
}

export type ActivityGroup = { label: string; items: ActivityItem[] };

const DAY_MS = 86_400_000;

function startOfDay(ms: number): number {
  const date = new Date(ms);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** New / Today / This week / This month / Earlier, in feed order. "New" is
 *  whatever arrived since the last visit, whenever that was; the rest bucket
 *  by the device's calendar day. Empty groups are dropped. */
export function groupActivity(
  items: ActivityItem[],
  lastSeen: number | null,
  now: number,
): ActivityGroup[] {
  const today = startOfDay(now);
  const order = ["New", "Today", "This week", "This month", "Earlier"];
  const buckets = new Map<string, ActivityItem[]>(order.map((label) => [label, []]));
  for (const item of items) {
    const at = timeOf(item.at);
    let label: string;
    // A first visit would put everything under "New", which says nothing --
    // only a returning viewer gets the split.
    if (lastSeen !== null && at > lastSeen) label = "New";
    else if (at >= today) label = "Today";
    else if (at >= today - 6 * DAY_MS) label = "This week";
    else if (at >= today - 29 * DAY_MS) label = "This month";
    else label = "Earlier";
    buckets.get(label)!.push(item);
  }
  return order
    .map((label) => ({ label, items: buckets.get(label)! }))
    .filter((group) => group.items.length > 0);
}

/* ---------- last-seen storage key ---------- */

/** Per account: two people signing in on one phone each have their own "new". */
export function lastSeenStorageKey(userId: string): string {
  return `oak.activity.lastSeen.${userId}`;
}

export function parseLastSeen(raw: string | null): number | null {
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}
