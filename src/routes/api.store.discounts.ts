import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/lib/integrations/my-supabase/client.server";
import { untypedTable } from "@/lib/integrations/my-supabase/untyped";
import { requireOwnStore } from "@/lib/server-auth";
import { parseDiscountInput, type DiscountCode, type DiscountInput } from "@/lib/discounts";
import { DISCOUNT_COLUMNS, isMissingTable, isUuid } from "@/lib/discounts.server";

// The signed-in seller's discount codes. The store always comes from the
// session (requireOwnStore), never from the request, and every read or write
// of one code is filtered by that store as well as by its id -- so someone
// else's code id is simply "not found", the same 404 a made-up id gets.
//
// discount_codes has RLS on with no write policies; this route, on the service
// role, is the only way a code is created, changed or removed.
const PRIVATE = { "Cache-Control": "no-store, private", Vary: "Authorization" } as const;

// A ceiling on codes per store. The list screen renders all of them at once,
// and nobody runs 200 promotions; a script creating thousands is the case this
// is for.
const MAX_CODES_PER_STORE = 200;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: PRIVATE });
}

const NOT_FOUND = () => json({ error: "Not found" }, 404);

// Until the migration is applied every query here fails with "no such table".
// The screen shows that as an honest "not switched on yet", not as an error.
const SETUP_PENDING = () =>
  json({ error: "Discount codes aren't switched on yet.", setupPending: true }, 503);

function columnsFor(v: DiscountInput) {
  return {
    code: v.code,
    kind: v.kind,
    percent_off: v.percentOff,
    amount_off_kobo: v.amountOffKobo,
    min_order_kobo: v.minOrderKobo,
    starts_at: v.startsAt,
    ends_at: v.endsAt,
    usage_limit: v.usageLimit,
    active: v.active,
  };
}

// 23505 is Postgres's unique violation: discount_codes_store_code_idx.
function duplicate(error: { code?: string } | null, code: string) {
  return error?.code === "23505"
    ? json({ error: `You already have a code called ${code}.` }, 409)
    : null;
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  const body = (await request.json().catch(() => null)) as unknown;
  return body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : null;
}

/** One of the caller's codes, or null when it doesn't exist or isn't theirs. */
async function ownCode(storeId: string, id: unknown) {
  if (!isUuid(id)) return { row: null, error: null };
  const { data, error } = await untypedTable(supabaseAdmin, "discount_codes")
    .select(DISCOUNT_COLUMNS)
    .eq("id", id)
    .eq("store_id", storeId)
    .maybeSingle();
  return { row: (data as DiscountCode | null) ?? null, error };
}

/** Total taken off per code, from the redemptions ledger. Best effort: the list
 *  still renders without it, so a failure here only hides the totals. */
async function redeemedTotals(ids: string[]): Promise<Map<string, number>> {
  const totals = new Map<string, number>();
  if (ids.length === 0) return totals;
  const { data, error } = await untypedTable(supabaseAdmin, "discount_redemptions")
    .select("discount_id, amount_kobo")
    .in("discount_id", ids);
  if (error) {
    console.error("discount redemptions lookup failed", error);
    return totals;
  }
  for (const r of (data ?? []) as { discount_id: string; amount_kobo: number }[]) {
    totals.set(r.discount_id, (totals.get(r.discount_id) ?? 0) + r.amount_kobo);
  }
  return totals;
}

export const Route = createFileRoute("/api/store/discounts")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const auth = await requireOwnStore(request);
        if (!auth.ok) {
          // Signed in without a store yet: a normal dashboard state, not an error.
          if (auth.response.status === 403) return json({ store: null, discounts: [] });
          return auth.response;
        }
        const { storeId } = auth.value;

        const [{ data: store }, { data: rows, error }] = await Promise.all([
          supabaseAdmin
            .from("stores")
            .select("id, brand_name, store_username")
            .eq("id", storeId)
            .maybeSingle(),
          untypedTable(supabaseAdmin, "discount_codes")
            .select(DISCOUNT_COLUMNS)
            .eq("store_id", storeId)
            .order("created_at", { ascending: false })
            .limit(MAX_CODES_PER_STORE),
        ]);
        if (error) {
          if (isMissingTable(error)) return SETUP_PENDING();
          console.error("discount list failed", error);
          return json({ error: "Couldn't load your discount codes." }, 500);
        }

        const codes = (rows ?? []) as DiscountCode[];
        const totals = await redeemedTotals(codes.map((c) => c.id));
        return json({
          store,
          discounts: codes.map((c) => ({ ...c, redeemed_kobo: totals.get(c.id) ?? 0 })),
        });
      },

      POST: async ({ request }: { request: Request }) => {
        const auth = await requireOwnStore(request);
        if (!auth.ok) return auth.response;
        const { storeId } = auth.value;

        const parsed = parseDiscountInput(await readBody(request), { now: new Date() });
        if (!parsed.ok) return json({ error: parsed.error }, 400);

        const { count, error: countError } = await untypedTable(supabaseAdmin, "discount_codes")
          .select("id", { count: "exact", head: true })
          .eq("store_id", storeId);
        if (countError) {
          if (isMissingTable(countError)) return SETUP_PENDING();
          console.error("discount count failed", countError);
          return json({ error: "Couldn't create the code. Try again." }, 500);
        }
        if ((count ?? 0) >= MAX_CODES_PER_STORE) {
          return json(
            { error: `You have ${MAX_CODES_PER_STORE} codes. Delete unused ones to add more.` },
            409,
          );
        }

        const { data, error } = await untypedTable(supabaseAdmin, "discount_codes")
          .insert({ ...columnsFor(parsed.value), store_id: storeId })
          .select(DISCOUNT_COLUMNS)
          .single();
        if (error) {
          const dup = duplicate(error, parsed.value.code);
          if (dup) return dup;
          console.error("discount create failed", error);
          return json({ error: "Couldn't create the code. Try again." }, 500);
        }
        return json({ discount: { ...(data as DiscountCode), redeemed_kobo: 0 } }, 201);
      },

      // Two shapes. {id, active} flips the switch on the list; anything with a
      // `code` is a full edit from the sheet and is validated like a create.
      PATCH: async ({ request }: { request: Request }) => {
        const auth = await requireOwnStore(request);
        if (!auth.ok) return auth.response;
        const { storeId } = auth.value;

        const body = await readBody(request);
        if (!body) return json({ error: "Bad request" }, 400);

        const { row: existing, error: readError } = await ownCode(storeId, body.id);
        if (readError) {
          if (isMissingTable(readError)) return SETUP_PENDING();
          console.error("discount read failed", readError);
          return json({ error: "Couldn't save the code. Try again." }, 500);
        }
        if (!existing) return NOT_FOUND();

        let changes: Record<string, unknown>;
        if (!("code" in body)) {
          if (typeof body.active !== "boolean") return json({ error: "Bad request" }, 400);
          changes = { active: body.active };
        } else {
          const parsed = parseDiscountInput(body, {
            now: new Date(),
            previousEndsAt: existing.ends_at,
          });
          if (!parsed.ok) return json({ error: parsed.error }, 400);
          if (parsed.value.usageLimit != null && parsed.value.usageLimit < existing.used_count) {
            return json(
              {
                error: `This code has been used ${existing.used_count} times already, so the limit can't be lower than that.`,
              },
              400,
            );
          }
          changes = columnsFor(parsed.value);
        }

        const { data, error } = await untypedTable(supabaseAdmin, "discount_codes")
          .update({ ...changes, updated_at: new Date().toISOString() })
          .eq("id", existing.id)
          .eq("store_id", storeId)
          .select(DISCOUNT_COLUMNS)
          .maybeSingle();
        if (error) {
          const dup = duplicate(error, String(changes.code ?? existing.code));
          if (dup) return dup;
          console.error("discount update failed", error);
          return json({ error: "Couldn't save the code. Try again." }, 500);
        }
        if (!data) return NOT_FOUND();

        const totals = await redeemedTotals([existing.id]);
        return json({
          discount: { ...(data as DiscountCode), redeemed_kobo: totals.get(existing.id) ?? 0 },
        });
      },

      // A code that has never been used is deleted outright. One that has been
      // used is part of past orders' records (discount_redemptions references
      // it with ON DELETE RESTRICT), so it is switched off instead and the
      // response says which happened.
      DELETE: async ({ request }: { request: Request }) => {
        const auth = await requireOwnStore(request);
        if (!auth.ok) return auth.response;
        const { storeId } = auth.value;

        const id = new URL(request.url).searchParams.get("id");
        const { row: existing, error: readError } = await ownCode(storeId, id);
        if (readError) {
          if (isMissingTable(readError)) return SETUP_PENDING();
          console.error("discount read failed", readError);
          return json({ error: "Couldn't delete the code. Try again." }, 500);
        }
        if (!existing) return NOT_FOUND();

        const deactivate = async () => {
          const { data, error } = await untypedTable(supabaseAdmin, "discount_codes")
            .update({ active: false, updated_at: new Date().toISOString() })
            .eq("id", existing.id)
            .eq("store_id", storeId)
            .select(DISCOUNT_COLUMNS)
            .maybeSingle();
          if (error || !data) {
            console.error("discount deactivate failed", error);
            return json({ error: "Couldn't turn the code off. Try again." }, 500);
          }
          const totals = await redeemedTotals([existing.id]);
          return json({
            deleted: false,
            discount: { ...(data as DiscountCode), redeemed_kobo: totals.get(existing.id) ?? 0 },
          });
        };

        if (existing.used_count > 0) return deactivate();

        const { error } = await untypedTable(supabaseAdmin, "discount_codes")
          .delete()
          .eq("id", existing.id)
          .eq("store_id", storeId);
        if (error) {
          // 23503: a redemption landed between the read above and this delete.
          // The foreign key refused, so fall back to switching it off.
          if (error.code === "23503") return deactivate();
          console.error("discount delete failed", error);
          return json({ error: "Couldn't delete the code. Try again." }, 500);
        }
        return json({ deleted: true, id: existing.id });
      },
    },
  },
});
