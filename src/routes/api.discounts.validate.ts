import { createFileRoute } from "@tanstack/react-router";
import { MAX_AMOUNT_KOBO } from "@/lib/discounts";
import { DiscountLookupError, isUuid, priceDiscount } from "@/lib/discounts.server";

// Checkout's "Apply" button: does this code work on this store for this
// subtotal, and for how much. Public and guest-friendly, so it is a guessing
// surface by design and is treated like one:
//
// - Rate-limited per IP. The limiter is in-memory, so it holds per server
//   instance, not globally -- it slows a script down rather than stopping a
//   determined one, which is the most a code-guess limiter can do anyway.
// - A code that is off, scheduled, expired or used up gets exactly the same
//   answer as one that never existed (see buyerMessage in lib/discounts.ts).
//
// Nothing here is charged. The subtotal is the browser's, used only to preview
// the amount; /api/orders re-prices the code against its own subtotal.
const NO_STORE = { "Cache-Control": "no-store, private" } as const;

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 12;
const hits = new Map<string, number[]>();

function limited(key: string) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  // A long-lived instance would otherwise keep one entry per visitor forever.
  if (hits.size > 5_000) {
    for (const [k, times] of hits) {
      if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
    }
  }
  return recent.length > MAX_PER_WINDOW;
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: NO_STORE });
}

export const Route = createFileRoute("/api/discounts/validate")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
        if (limited(ip)) {
          return json({ ok: false, message: "Too many tries. Wait a minute and try again." }, 429);
        }

        const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
        const storeId = body?.storeId;
        const code = body?.code;
        const subtotalKobo = body?.subtotalKobo;
        if (
          !isUuid(storeId) ||
          typeof code !== "string" ||
          code.length > 64 ||
          typeof subtotalKobo !== "number" ||
          !Number.isSafeInteger(subtotalKobo) ||
          subtotalKobo < 0 ||
          subtotalKobo > MAX_AMOUNT_KOBO
        ) {
          return json({ ok: false, message: "Bad request" }, 400);
        }

        try {
          const priced = await priceDiscount({ storeId, code, subtotalKobo });
          if (!priced.ok) return json({ ok: false, message: priced.message });
          return json({ ok: true, code: priced.code, amountKobo: priced.amountKobo });
        } catch (err) {
          if (!(err instanceof DiscountLookupError)) console.error("discount validate failed", err);
          return json({ ok: false, message: "Couldn't check that code. Try again." }, 502);
        }
      },
    },
  },
});
