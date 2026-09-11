const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** Instagram-style short relative stamp: 9m · 2h · 4d · 6w. */
export function relativeShort(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 53) return `${weeks}w`;
  return `${Math.floor(days / 365)}y`;
}

export function activeLabel(minutes: number | null): string | null {
  if (minutes === null) return null;
  if (minutes === 0) return "Active now";
  if (minutes < 60) return `Active ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Active ${hours}h ago`;
  return `Active ${Math.floor(hours / 24)}d ago`;
}

export function clockTime(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** TODAY · YESTERDAY · 6 MAR AT 14:10 */
export function dayDividerLabel(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const dayDiff = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (dayDiff <= 0) return "TODAY";
  if (dayDiff === 1) return "YESTERDAY";
  return `${date.getDate()} ${MONTHS[date.getMonth()]} AT ${clockTime(iso)}`;
}

export function sameDay(a: string, b: string): boolean {
  return startOfDay(new Date(a)) === startOfDay(new Date(b));
}

/** Two messages belong to one visual group when same sender, same day, < 4 min apart. */
export function groupsWith(previousIso: string, iso: string): boolean {
  return (
    sameDay(previousIso, iso) &&
    Math.abs(new Date(iso).getTime() - new Date(previousIso).getTime()) < 4 * 60_000
  );
}

export function haptic(duration = 8) {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try {
      navigator.vibrate(duration);
    } catch {
      /* Safari and locked-down browsers: ignore. */
    }
  }
}
