// Display formatting for the order screens. Money arrives as integer kobo from
// the server and is only ever turned into naira here, for reading.

export function nairaFromKobo(kobo: number): string {
  const whole = kobo % 100 === 0;
  return `₦${(kobo / 100).toLocaleString("en-NG", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** "Today, 14:05", "Yesterday, 09:12", "8 Oct, 14:05", "8 Oct 2025". Spelled
 *  out by hand rather than through Intl's date styles, whose output differs by
 *  engine and locale -- a seller and a buyer looking at the same order should
 *  read the same words. Local time, because that's when it happened to them. */
export function formatOrderTime(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (sameDay(d, now)) return `Today, ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, yesterday)) return `Yesterday, ${time}`;
  const date = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  if (d.getFullYear() !== now.getFullYear()) return `${date} ${d.getFullYear()}`;
  return `${date}, ${time}`;
}
