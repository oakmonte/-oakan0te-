import type { SupabaseClient } from "@supabase/supabase-js";

// Bridge for tables whose migration is written but NOT yet applied, so they are
// not in the generated `types.ts` (it can only be regenerated from the live
// database, and a hook blocks hand-editing it). Nothing here is checked against
// the real schema: callers cast rows to their own type, e.g.
//
//   const { data } = await untypedTable(supabaseAdmin, "discount_codes")
//     .select("id, code, percent_off")
//     .eq("store_id", storeId);
//   const codes = (data ?? []) as DiscountRow[];
//
// Use it ONLY for such tables. Once the migration is applied and types are
// regenerated, replace each call with the normal typed `.from("table")`, which
// catches the column mistakes this cannot.
export function untypedTable(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any, any, any>,
  table: string,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as unknown as SupabaseClient<any>).from(table);
}
