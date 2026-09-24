import { supabase } from "@/lib/integrations/my-supabase/client";

// Mirrors deleteCollection in src/lib/collections.ts, minus the "with
// products" variant -- a drop is only ever a lens over existing
// products/collections, never something that owns them, so there's nothing
// else to offer deleting alongside it. drop_products cascades on drop_id,
// so membership rows disappear on their own; the products themselves (and
// the collection, if the drop wraps one) are untouched.
//
// storeId scopes the delete as a defense-in-depth check -- RLS is off on
// `drops` (see the drops migration), so with a spoofed/guessed id this is
// the only thing standing between "delete my own drop" and deleting someone
// else's, same reasoning as deleteProducts in ProductsPanel.tsx.
export async function deleteDrop(
  dropId: string | string[],
  storeId: string,
): Promise<{ error: string | null }> {
  const { error } = Array.isArray(dropId)
    ? await supabase.from("drops").delete().in("id", dropId).eq("store_id", storeId)
    : await supabase.from("drops").delete().eq("id", dropId).eq("store_id", storeId);
  return { error: error?.message ?? null };
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86400_000],
  ["hour", 3600_000],
  ["minute", 60_000],
];
const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto", style: "short" });

function relative(target: Date, now: Date): string {
  const diffMs = target.getTime() - now.getTime();
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diffMs) >= ms || unit === "minute") {
      return rtf.format(Math.round(diffMs / ms), unit);
    }
  }
  return rtf.format(0, "minute");
}

// starts_at/ends_at are both optional -- null/null is a plain "new drop"
// announcement with no timer. Shared between DropsPanel's list rows and the
// drop detail page so the two never drift on what a given state is called.
export function dropStatusLabel(
  startsAt: string | null,
  endsAt: string | null,
  now: Date = new Date(),
): string {
  const starts = startsAt ? new Date(startsAt) : null;
  const ends = endsAt ? new Date(endsAt) : null;

  if (starts && starts > now) return `Starts ${relative(starts, now)}`;
  if (ends && ends <= now) return "Ended";
  if (ends) return `Ends ${relative(ends, now)}`;
  return "New";
}
