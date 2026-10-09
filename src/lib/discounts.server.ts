import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/integrations/my-supabase/client.server";
import { untypedTable } from "@/lib/integrations/my-supabase/untyped";
import {
  buyerMessage,
  isValidCode,
  normaliseCode,
  NOT_VALID_MESSAGE,
  validateDiscount,
  type DiscountCode,
} from "@/lib/discounts";

// Server-side discount lookups, shared by the public preview route
// (api.discounts.validate.ts) and order creation (api.orders.ts, once wired).
// Both must find a code the same way and price it with the same rules, or a
// buyer could be shown one discount and charged another.
//
// discount_codes is not in the generated types until its migration
// (20261008122000_discount_codes.sql) is applied, hence untypedTable. Swap to
// the typed `.from("discount_codes")` once types are regenerated.

export const DISCOUNT_COLUMNS =
  "id, store_id, code, kind, percent_off, amount_off_kobo, min_order_kobo, starts_at, ends_at, usage_limit, used_count, active, created_at";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A uuid-shaped string. Checked before querying because Postgres answers a
 *  malformed uuid with an error, which would surface as a 500 rather than the
 *  404 / "not valid" an unknown id deserves. */
export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

/** PostgREST's "no such table" (PGRST205) and Postgres's own (42P01): what every
 *  query here returns until the migration is applied. Callers turn it into an
 *  honest "not switched on yet" instead of a generic failure. */
export function isMissingTable(error: { code?: string } | null | undefined): boolean {
  return error?.code === "PGRST205" || error?.code === "42P01";
}

export class DiscountLookupError extends Error {}

/** The store's code matching what the buyer typed, or null. Throws
 *  DiscountLookupError only when the database itself failed, so a caller can
 *  say "try again" rather than wrongly telling the buyer the code is bad. */
export async function findStoreDiscount(
  storeId: string,
  rawCode: string,
): Promise<DiscountCode | null> {
  const code = normaliseCode(rawCode);
  if (!isUuid(storeId) || !isValidCode(code)) return null;

  // Codes are stored normalised (the create route runs normaliseCode), so a
  // plain equality match is the case-insensitive match buyers expect.
  const { data, error } = await untypedTable(supabaseAdmin, "discount_codes")
    .select(DISCOUNT_COLUMNS)
    .eq("store_id", storeId)
    .eq("code", code)
    .maybeSingle();
  if (error) {
    // Before the migration there are no codes at all, which is the truth.
    if (isMissingTable(error)) return null;
    console.error("discount lookup failed", error);
    throw new DiscountLookupError("discount lookup failed");
  }
  return (data as DiscountCode | null) ?? null;
}

export type PricedDiscount =
  | { ok: true; discountId: string; code: string; amountKobo: number }
  | { ok: false; message: string };

/** Finds and prices a code for an order of `subtotalKobo`. The subtotal MUST be
 *  the server's own figure when this decides what an order costs; the preview
 *  route passes the browser's, which is fine there because nothing is charged
 *  off the back of it. */
export async function priceDiscount(input: {
  storeId: string;
  code: string;
  subtotalKobo: number;
  now?: Date;
}): Promise<PricedDiscount> {
  const row = await findStoreDiscount(input.storeId, input.code);
  if (!row) return { ok: false, message: NOT_VALID_MESSAGE };
  const check = validateDiscount(row, {
    subtotalKobo: input.subtotalKobo,
    now: input.now ?? new Date(),
  });
  if (!check.ok) return { ok: false, message: buyerMessage(check) ?? NOT_VALID_MESSAGE };
  return { ok: true, discountId: row.id, code: row.code, amountKobo: check.amountKobo };
}

export type RedemptionResult = "redeemed" | "already_redeemed" | "limit_reached" | "not_found";

/** Counts one use of a code against an order, through redeem_discount_code
 *  (see the migration): the increment has to happen inside Postgres, under a
 *  row lock, or two payments settling at once would both read the same
 *  used_count. Safe to call twice for one order.
 *
 *  Pass allowOverLimit once the buyer has PAID the discounted price -- the use
 *  is honoured even if a concurrent order took the last one. */
export async function recordRedemption(input: {
  discountId: string;
  orderId: string;
  amountKobo: number;
  allowOverLimit: boolean;
}): Promise<RedemptionResult> {
  // The function is not in the generated types yet either; same bridge as
  // untypedTable, for .rpc().
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabaseAdmin as unknown as SupabaseClient<any>;
  const { data, error } = await client.rpc("redeem_discount_code", {
    p_discount_id: input.discountId,
    p_order_id: input.orderId,
    p_amount_kobo: input.amountKobo,
    p_allow_over_limit: input.allowOverLimit,
  });
  if (error) {
    console.error("redeem_discount_code failed", error);
    throw new DiscountLookupError("could not record the discount redemption");
  }
  return data as RedemptionResult;
}
