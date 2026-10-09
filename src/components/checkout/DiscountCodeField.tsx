import { useCallback, useEffect, useRef, useState } from "react";
import { Tag, X } from "lucide-react";
import { formatKobo, normaliseCode } from "@/lib/discounts";

// The buyer's discount code box for checkout. It only PREVIEWS: it asks
// /api/discounts/validate what a code is worth on this subtotal and reports
// {code, amountKobo} upward so the summary can show it. What the buyer is
// actually charged is decided by /api/orders, which re-prices the code against
// its own subtotal -- so send the code with the order, never the amount.
//
// Written in chat-* tokens: it renders in whatever surface checkout uses and
// follows that surface's light/dark set.

export type AppliedDiscount = { code: string; amountKobo: number };

type CheckResponse =
  | { ok: true; code: string; amountKobo: number }
  | { ok: false; message: string };

async function checkCode(
  input: { storeId: string; code: string; subtotalKobo: number },
  signal: AbortSignal,
): Promise<CheckResponse> {
  const res = await fetch("/api/discounts/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal,
  });
  const body = (await res.json().catch(() => null)) as CheckResponse | null;
  if (body && (body.ok || body.message)) return body;
  return { ok: false, message: "Couldn't check that code. Try again." };
}

export function DiscountCodeField({
  storeId,
  subtotalKobo,
  onChange,
  disabled = false,
}: {
  storeId: string;
  /** The items total in kobo (no delivery): what the code comes off. */
  subtotalKobo: number;
  /** Called with the applied code, or null when there is none (removed, or no
   *  longer valid because the subtotal changed). */
  onChange: (applied: AppliedDiscount | null) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  // The subtotal each applied code was priced for, so a change can be spotted.
  const [applied, setApplied] = useState<(AppliedDiscount & { forSubtotal: number }) | null>(null);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const inFlight = useRef<AbortController | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => inFlight.current?.abort(), []);

  const run = useCallback(
    async (code: string, subtotal: number): Promise<CheckResponse | null> => {
      // A newer check always wins: an older answer arriving late must not
      // overwrite it (a fast double tap, or the subtotal changing mid-check).
      inFlight.current?.abort();
      const controller = new AbortController();
      inFlight.current = controller;
      setChecking(true);
      try {
        return await checkCode({ storeId, code, subtotalKobo: subtotal }, controller.signal);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return null;
        return {
          ok: false,
          message: "Couldn't check that code. Check your connection and try again.",
        };
      } finally {
        if (inFlight.current === controller) {
          inFlight.current = null;
          setChecking(false);
        }
      }
    },
    [storeId],
  );

  async function apply() {
    const code = normaliseCode(text);
    if (!code) {
      setMessage("Enter a code first.");
      return;
    }
    setMessage(null);
    const result = await run(code, subtotalKobo);
    if (!result) return;
    if (result.ok) {
      setApplied({ code: result.code, amountKobo: result.amountKobo, forSubtotal: subtotalKobo });
      setText("");
      onChangeRef.current({ code: result.code, amountKobo: result.amountKobo });
    } else {
      setMessage(result.message);
    }
  }

  function remove() {
    inFlight.current?.abort();
    setApplied(null);
    setMessage(null);
    onChangeRef.current(null);
  }

  // The amount depends on the subtotal, so a changed subtotal (another size,
  // another quantity) re-checks the applied code: a percentage moves with it,
  // and a minimum may stop being met. The summary must never show a discount
  // the order route would refuse.
  useEffect(() => {
    if (!applied || applied.forSubtotal === subtotalKobo) return;
    let cancelled = false;
    void run(applied.code, subtotalKobo).then((result) => {
      if (cancelled || !result) return;
      if (result.ok) {
        setApplied({ code: result.code, amountKobo: result.amountKobo, forSubtotal: subtotalKobo });
        onChangeRef.current({ code: result.code, amountKobo: result.amountKobo });
      } else {
        // Hand the code back to the box with the reason, rather than making it
        // vanish: the buyer can see why and remove it or adjust the order.
        setApplied(null);
        setText(applied.code);
        setOpen(true);
        setMessage(result.message);
        onChangeRef.current(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [applied, subtotalKobo, run]);

  if (applied) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-chat-border bg-chat-soft px-4 py-2.5">
        <Tag size={18} className="shrink-0 text-chat-muted" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold tracking-[0.04em] text-chat-text">
            {applied.code}
          </p>
          <p className="text-[13px] text-chat-muted" aria-live="polite">
            {checking ? "Updating…" : `−${formatKobo(applied.amountKobo)} off your items`}
          </p>
        </div>
        <button
          type="button"
          onClick={remove}
          disabled={disabled}
          aria-label={`Remove code ${applied.code}`}
          className="-mr-2 grid h-10 w-10 shrink-0 place-items-center rounded-full text-chat-muted active:bg-chat-border disabled:opacity-40"
        >
          <X size={18} />
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setOpen(true);
          // Focus after the input exists, so the keyboard comes up in one tap.
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
        className="flex h-11 items-center gap-2 self-start text-[15px] text-chat-text underline-offset-4 active:underline disabled:opacity-40"
      >
        <Tag size={16} className="text-chat-muted" />
        Have a discount code?
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void apply();
        }}
      >
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => {
            setText(normaliseCode(e.target.value));
            if (message) setMessage(null);
          }}
          placeholder="Discount code"
          aria-label="Discount code"
          aria-invalid={!!message}
          maxLength={24}
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          disabled={disabled}
          className={`h-12 min-w-0 flex-1 rounded-2xl border bg-chat-soft px-4 text-[16px] font-semibold tracking-[0.04em] text-chat-text outline-none placeholder:font-normal placeholder:tracking-normal placeholder:text-chat-faint ${
            message ? "border-chat-danger" : "border-chat-border focus:border-chat-muted"
          }`}
        />
        <button
          type="submit"
          disabled={disabled || checking || !text}
          className="h-12 shrink-0 rounded-2xl bg-chat-text px-5 text-[15px] font-semibold text-chat-inverse disabled:opacity-40"
        >
          {checking ? "Checking…" : "Apply"}
        </button>
      </form>
      <p className="min-h-[18px] text-[13px] text-chat-danger" aria-live="polite">
        {message ?? ""}
      </p>
    </div>
  );
}
