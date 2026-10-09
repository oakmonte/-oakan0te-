import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/lib/integrations/my-supabase/client.server";
import { listInbox, requireCaller, type ChatDb } from "@/lib/chat/chat.server";
import {
  BUYER_STATUSES,
  SELLER_STATUSES,
  buildBuyerOrderItems,
  buildFollowItems,
  buildMessageItems,
  buildSellerOrderItems,
  mergeActivity,
  type ActivityFeed,
  type ActivityItem,
  type ActivitySource,
} from "@/lib/activity-model";

// The caller's activity centre, derived on every request from the tables that
// already hold the truth -- there is no notifications table behind this (see
// activity-model.ts). Every query is scoped to the session's own user id; the
// request carries no ids at all, so there is nothing to swap for someone
// else's.
//
// Each source loads independently. One failing (the inbox RPC, say) leaves
// the others intact and is named in `unavailable`, so the screen can say
// "messages couldn't load" instead of showing a feed that silently lost them.
const PRIVATE = { "Cache-Control": "no-store, private", Vary: "Authorization" } as const;

const FOLLOWER_LIMIT = 60;
const ORDER_LIMIT = 40;

type Loaded = { items: ActivityItem[] } | null;

async function loadFollowers(me: string): Promise<ActivityItem[]> {
  const { data: follows, error } = await supabaseAdmin
    .from("follows")
    .select("follower_id, created_at")
    .eq("following_id", me)
    .order("created_at", { ascending: false })
    .limit(FOLLOWER_LIMIT);
  if (error) throw error;
  const ids = (follows ?? []).map((row) => row.follower_id).filter((id) => id !== me);
  if (ids.length === 0) return [];

  const [profiles, mine, blocks] = await Promise.all([
    // public_profiles, not profiles: the view is the set of columns anyone may
    // see about anyone. The service role could read more; it shouldn't.
    supabaseAdmin
      .from("public_profiles")
      .select("id, personal_username, display_name, avatar_url")
      .in("id", ids),
    supabaseAdmin
      .from("follows")
      .select("following_id")
      .eq("follower_id", me)
      .in("following_id", ids),
    supabaseAdmin
      .from("user_blocks")
      .select("blocked_id")
      .eq("blocker_id", me)
      .in("blocked_id", ids),
  ]);
  if (profiles.error) throw profiles.error;
  if (mine.error) throw mine.error;
  if (blocks.error) throw blocks.error;

  return buildFollowItems({
    me,
    follows: follows ?? [],
    profiles: profiles.data ?? [],
    iFollow: (mine.data ?? []).map((row) => row.following_id),
    blocked: (blocks.data ?? []).map((row) => row.blocked_id),
  });
}

async function loadBuyerOrders(me: string): Promise<ActivityItem[]> {
  const { data: orders, error } = await supabaseAdmin
    .from("orders")
    .select("id, status, store_id, total_kobo, updated_at")
    .eq("buyer_id", me)
    .in("status", [...BUYER_STATUSES])
    .order("updated_at", { ascending: false })
    .limit(ORDER_LIMIT);
  if (error) throw error;
  if (!orders?.length) return [];

  const storeIds = [...new Set(orders.map((order) => order.store_id))];
  const [lines, stores] = await Promise.all([
    supabaseAdmin
      .from("order_items")
      .select("order_id, title, image_url")
      .in(
        "order_id",
        orders.map((order) => order.id),
      ),
    supabaseAdmin.from("stores").select("id, brand_name").in("id", storeIds),
  ]);
  if (lines.error) throw lines.error;
  if (stores.error) throw stores.error;

  return buildBuyerOrderItems({
    orders,
    lines: lines.data ?? [],
    storeNames: new Map((stores.data ?? []).map((store) => [store.id, store.brand_name])),
  });
}

/** The seller half. Same store requireOwnStore resolves (oldest, id as the
 *  tie-break), so every order here is one /store/orders actually lists --
 *  linking a seller to a screen that doesn't show the order would be worse
 *  than not mentioning it. Inlined rather than calling requireOwnStore because
 *  "no store" is an ordinary answer here, not a 403, and the session is
 *  already validated. */
async function loadSellerOrders(me: string): Promise<{ items: ActivityItem[]; isSeller: boolean }> {
  const { data: stores, error: storeError } = await supabaseAdmin
    .from("stores")
    .select("id")
    .eq("owner_id", me)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(1);
  if (storeError) throw storeError;
  const storeId = stores?.[0]?.id;
  if (!storeId) return { items: [], isSeller: false };

  const { data: orders, error } = await supabaseAdmin
    .from("orders")
    .select("id, status, total_kobo, ship_to, updated_at")
    .eq("store_id", storeId)
    .in("status", [...SELLER_STATUSES])
    .order("updated_at", { ascending: false })
    .limit(ORDER_LIMIT);
  if (error) throw error;
  if (!orders?.length) return { items: [], isSeller: true };

  const ids = orders.map((order) => order.id);
  const [payments, lines] = await Promise.all([
    supabaseAdmin
      .from("order_payments")
      .select("order_id, confirmed_at")
      .in("order_id", ids)
      .eq("status", "confirmed"),
    supabaseAdmin.from("order_items").select("order_id, title, image_url").in("order_id", ids),
  ]);
  if (payments.error) throw payments.error;
  if (lines.error) throw lines.error;

  return {
    items: buildSellerOrderItems({
      orders,
      payments: payments.data ?? [],
      lines: lines.data ?? [],
    }),
    isSeller: true,
  };
}

/** list_inbox runs as the caller (their token, not the service role), so the
 *  messaging migrations' RLS still decides which chats exist for them. Only
 *  counts and the other person come back out -- never a message body. */
async function loadMessages(db: ChatDb): Promise<ActivityItem[]> {
  return buildMessageItems(await listInbox(db));
}

function settle(source: ActivitySource, unavailable: ActivitySource[]) {
  return (err: unknown): Loaded => {
    console.error(`activity: ${source} failed to load`, err);
    unavailable.push(source);
    return null;
  };
}

export const Route = createFileRoute("/api/activity")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        // Validates the session and hands back a client that queries as the
        // caller (for the inbox). 401 without a valid token.
        const caller = await requireCaller(request);
        if (!caller.ok) return caller.response;
        const { me, db } = caller.value;

        const unavailable: ActivitySource[] = [];
        let isSeller = false;
        const [followers, buyerOrders, sellerOrders, messages] = await Promise.all([
          loadFollowers(me).then((items) => ({ items }), settle("followers", unavailable)),
          loadBuyerOrders(me).then((items) => ({ items }), settle("orders", unavailable)),
          loadSellerOrders(me).then(
            (result) => {
              isSeller = result.isSeller;
              return { items: result.items };
            },
            settle("store-orders", unavailable),
          ),
          loadMessages(db).then((items) => ({ items }), settle("messages", unavailable)),
        ]);

        // Nothing at all loaded: that's an outage, not an empty feed. A 500
        // lets the screen offer "Try again" instead of "No activity yet".
        if (unavailable.length === 4) {
          return Response.json(
            { error: "Couldn't load your activity" },
            { status: 500, headers: PRIVATE },
          );
        }

        const feed: ActivityFeed = {
          items: mergeActivity(
            [followers, buyerOrders, sellerOrders, messages].map((loaded) => loaded?.items ?? []),
          ),
          isSeller,
          unavailable,
        };
        return Response.json(feed, { headers: PRIVATE });
      },
    },
  },
});
