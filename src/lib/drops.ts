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

export type LiveDrop = {
  id: string;
  title: string;
  starts_at: string | null;
  ends_at: string | null;
};

/** The one drop a storefront's drop banner announces, or null for none.
 *  Ended drops never count: a banner for something that's over is the
 *  "empty element" this exists to prevent. A drop that's already running
 *  beats one that hasn't started, since it's the one a shopper can act on
 *  now. Among upcoming drops the soonest wins, and among running ones the
 *  one ending soonest, then the untimed "new drop" announcements. */
export function pickLiveDrop<T extends LiveDrop>(drops: T[], now: Date = new Date()): T | null {
  const t = now.getTime();
  const at = (s: string | null) => (s ? new Date(s).getTime() : null);
  const open = drops.filter((d) => {
    const ends = at(d.ends_at);
    return ends === null || ends > t;
  });
  const running = open.filter((d) => {
    const starts = at(d.starts_at);
    return starts === null || starts <= t;
  });
  const soonest = (key: "starts_at" | "ends_at") => (a: T, b: T) =>
    (at(a[key]) ?? Infinity) - (at(b[key]) ?? Infinity);
  if (running.length > 0) return [...running].sort(soonest("ends_at"))[0];
  return [...open].sort(soonest("starts_at"))[0] ?? null;
}

/** What the drop banner counts down to: the start if the drop hasn't
 *  started, otherwise the end. Null for a drop with no timer, or one whose
 *  moment has passed. */
export function dropCountdown(
  drop: LiveDrop,
  now: Date = new Date(),
): { label: "Starts in" | "Ends in"; msLeft: number } | null {
  const t = now.getTime();
  const starts = drop.starts_at ? new Date(drop.starts_at).getTime() : null;
  const ends = drop.ends_at ? new Date(drop.ends_at).getTime() : null;
  if (starts !== null && starts > t) return { label: "Starts in", msLeft: starts - t };
  if (ends !== null && ends > t) return { label: "Ends in", msLeft: ends - t };
  return null;
}

/** "2d 04:12:09", or "04:12:09" under a day. Clamped at zero. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const pad = (n: number) => String(n).padStart(2, "0");
  const clock = `${pad(Math.floor((total % 86400) / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
  return days > 0 ? `${days}d ${clock}` : clock;
}
