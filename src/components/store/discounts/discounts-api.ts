import { authedFetch } from "@/lib/authed-fetch";
import type { DiscountCode, DiscountKind } from "@/lib/discounts";

// Browser side of /api/store/discounts. Every call goes through authedFetch:
// the route runs on the service role and only knows who is asking from the
// bearer token attached here.

/** A code as the list shows it, with the total it has taken off so far. */
export type StoreDiscount = DiscountCode & { redeemed_kobo: number };

export type DiscountStore = { id: string; brand_name: string; store_username: string };

export type DiscountsLoad =
  | { kind: "ok"; store: DiscountStore | null; discounts: StoreDiscount[] }
  /** The migration isn't applied yet, so there is no table to read. */
  | { kind: "setup_pending" };

/** What the sheet sends; mirrors parseDiscountInput on the server. */
export type DiscountPayload = {
  code: string;
  kind: DiscountKind;
  percentOff: number | null;
  amountOffKobo: number | null;
  minOrderKobo: number;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  active: boolean;
};

async function errorFrom(res: Response, fallback: string): Promise<Error> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return new Error(body?.error ?? fallback);
}

const JSON_HEADERS = { "Content-Type": "application/json" };

export async function loadDiscounts(): Promise<DiscountsLoad> {
  const res = await authedFetch("/api/store/discounts");
  if (res.status === 503) {
    const body = (await res.json().catch(() => null)) as { setupPending?: boolean } | null;
    if (body?.setupPending) return { kind: "setup_pending" };
  }
  if (res.status === 401) throw new Error("Your session ended. Sign in again to see your codes.");
  if (!res.ok) throw await errorFrom(res, "Couldn't load your discount codes.");
  const body = (await res.json()) as { store: DiscountStore | null; discounts: StoreDiscount[] };
  return { kind: "ok", store: body.store, discounts: body.discounts ?? [] };
}

export async function createDiscount(payload: DiscountPayload): Promise<StoreDiscount> {
  const res = await authedFetch("/api/store/discounts", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw await errorFrom(res, "Couldn't create the code.");
  return ((await res.json()) as { discount: StoreDiscount }).discount;
}

export async function updateDiscount(id: string, payload: DiscountPayload): Promise<StoreDiscount> {
  const res = await authedFetch("/api/store/discounts", {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify({ ...payload, id }),
  });
  if (!res.ok) throw await errorFrom(res, "Couldn't save the code.");
  return ((await res.json()) as { discount: StoreDiscount }).discount;
}

export async function setDiscountActive(id: string, active: boolean): Promise<StoreDiscount> {
  const res = await authedFetch("/api/store/discounts", {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify({ id, active }),
  });
  if (!res.ok)
    throw await errorFrom(
      res,
      active ? "Couldn't turn the code on." : "Couldn't turn the code off.",
    );
  return ((await res.json()) as { discount: StoreDiscount }).discount;
}

/** Deletes a never-used code; a used one comes back switched off instead. */
export async function deleteDiscount(
  id: string,
): Promise<{ deleted: true } | { deleted: false; discount: StoreDiscount }> {
  const res = await authedFetch(`/api/store/discounts?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw await errorFrom(res, "Couldn't delete the code.");
  const body = (await res.json()) as { deleted: boolean; discount?: StoreDiscount };
  return body.deleted
    ? { deleted: true }
    : { deleted: false, discount: body.discount as StoreDiscount };
}
