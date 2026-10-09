import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Shuffle, X } from "lucide-react";
import { useLockedViewport } from "@/hooks/use-locked-viewport";
import { DateTimeField } from "@/components/store/drops/DateTimeField";
import {
  codeProblem,
  describeDiscount,
  formatKobo,
  generateCode,
  koboToNairaInput,
  MAX_AMOUNT_KOBO,
  MAX_USAGE_LIMIT,
  normaliseCode,
  parseNairaToKobo,
  PERCENT_MAX,
  PERCENT_MIN,
  type DiscountKind,
} from "@/lib/discounts";
import {
  createDiscount,
  deleteDiscount,
  updateDiscount,
  type DiscountPayload,
  type DiscountStore,
  type StoreDiscount,
} from "./discounts-api";

const PERCENT_PRESETS = [10, 15, 20, 25, 50];

// Field errors in the seller's words. The server runs parseDiscountInput on
// whatever is sent, so these exist for instant feedback, not for safety.
function percentProblem(text: string): string | null {
  if (text === "") return "Enter a percentage";
  const n = Number(text);
  if (!/^\d{1,2}$/.test(text) || n < PERCENT_MIN || n > PERCENT_MAX) {
    return `Use a whole number from ${PERCENT_MIN} to ${PERCENT_MAX}`;
  }
  return null;
}

function nairaProblem(text: string, { required }: { required: boolean }): string | null {
  if (text.trim() === "") return required ? "Enter an amount" : null;
  const kobo = parseNairaToKobo(text);
  if (kobo == null) return "Enter an amount like 2,500";
  if (required && kobo < 100) return "Enter at least ₦1";
  if (kobo > MAX_AMOUNT_KOBO) return "That amount is too large";
  return null;
}

function limitProblem(text: string, usedCount: number): string | null {
  if (text.trim() === "") return null;
  if (!/^\d+$/.test(text)) return "Enter a whole number, or leave it empty";
  const n = Number(text);
  if (n < 1) return "Enter 1 or more, or leave it empty";
  if (n > MAX_USAGE_LIMIT) return "That limit is too large";
  if (n < usedCount) return `Already used ${usedCount} times, so it can't be lower than that`;
  return null;
}

const when = (d: Date) => format(d, "EEE d MMM, h:mm a");

export function DiscountSheet({
  store,
  existing,
  onSaved,
  onDeleted,
  onClose,
}: {
  store: DiscountStore | null;
  /** null to create a new code. */
  existing: StoreDiscount | null;
  onSaved: (discount: StoreDiscount) => void;
  onDeleted: (id: string) => void;
  onClose: () => void;
}) {
  useLockedViewport();

  const [code, setCode] = useState(existing?.code ?? "");
  const [kind, setKind] = useState<DiscountKind>(existing?.kind ?? "percent");
  const [percent, setPercent] = useState(
    existing?.percent_off != null ? String(existing.percent_off) : "",
  );
  const [amount, setAmount] = useState(koboToNairaInput(existing?.amount_off_kobo));
  const [minOrder, setMinOrder] = useState(koboToNairaInput(existing?.min_order_kobo));
  const [startsAt, setStartsAt] = useState<Date | null>(
    existing?.starts_at ? new Date(existing.starts_at) : null,
  );
  const [endsAt, setEndsAt] = useState<Date | null>(
    existing?.ends_at ? new Date(existing.ends_at) : null,
  );
  const [usageLimit, setUsageLimit] = useState(
    existing?.usage_limit != null ? String(existing.usage_limit) : "",
  );
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);

  // A second tap confirms; left alone, the button goes back to normal.
  useEffect(() => {
    if (!confirmRemove) return;
    const t = setTimeout(() => setConfirmRemove(false), 4000);
    return () => clearTimeout(t);
  }, [confirmRemove]);

  const usedCount = existing?.used_count ?? 0;
  const normalised = normaliseCode(code);
  const errors = {
    code: codeProblem(normalised),
    value: kind === "percent" ? percentProblem(percent) : nairaProblem(amount, { required: true }),
    minOrder: nairaProblem(minOrder, { required: false }),
    usageLimit: limitProblem(usageLimit, usedCount),
    dates: startsAt && endsAt && endsAt <= startsAt ? "The end has to be after the start" : null,
  };
  const hasErrors = Object.values(errors).some(Boolean);

  const amountKobo = parseNairaToKobo(amount);
  const minKobo = minOrder.trim() === "" ? 0 : parseNairaToKobo(minOrder);
  const limit = usageLimit.trim() === "" ? null : Number(usageLimit);

  // What a buyer gets, in one sentence, once the numbers make sense.
  const preview =
    !errors.value && !errors.minOrder && minKobo != null
      ? describeDiscount({
          kind,
          percent_off: kind === "percent" ? Number(percent) : null,
          amount_off_kobo: kind === "fixed" ? amountKobo : null,
          min_order_kobo: minKobo,
        })
      : null;

  // A fixed amount bigger than the minimum order makes small orders free.
  // Allowed (a seller may mean it), but worth saying out loud.
  const freeOrderRisk =
    kind === "fixed" &&
    amountKobo != null &&
    minKobo != null &&
    !errors.value &&
    amountKobo > minKobo;

  function payload(): DiscountPayload {
    return {
      code: normalised,
      kind,
      percentOff: kind === "percent" ? Number(percent) : null,
      amountOffKobo: kind === "fixed" ? amountKobo : null,
      minOrderKobo: minKobo ?? 0,
      startsAt: startsAt?.toISOString() ?? null,
      endsAt: endsAt?.toISOString() ?? null,
      usageLimit: limit,
      active: existing?.active ?? true,
    };
  }

  async function save() {
    if (hasErrors) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const saved = existing
        ? await updateDiscount(existing.id, payload())
        : await createDiscount(payload());
      onSaved(saved);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Couldn't save the code.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!existing) return;
    if (!confirmRemove) {
      setConfirmRemove(true);
      return;
    }
    setRemoving(true);
    setSaveError(null);
    try {
      const result = await deleteDiscount(existing.id);
      if (result.deleted) onDeleted(existing.id);
      else onSaved(result.discount);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Couldn't delete the code.");
    } finally {
      setRemoving(false);
      setConfirmRemove(false);
    }
  }

  const err = (msg: string | null) =>
    showErrors && msg ? <p className="mt-1.5 text-[13px] text-sd-danger-ink">{msg}</p> : null;
  const ring = (msg: string | null) =>
    showErrors && msg ? "border-sd-danger-mark/60" : "border-sd-line";

  // Used codes can't be deleted (past orders point at them), only switched off.
  const removeLabel =
    usedCount > 0
      ? confirmRemove
        ? "Tap again to turn it off"
        : "Turn off code"
      : confirmRemove
        ? "Tap again to delete"
        : "Delete code";
  const showRemove = existing && (usedCount === 0 || existing.active);

  return (
    <div className="fixed inset-0 z-50 flex min-h-dvh flex-col bg-sd-surface text-sd-ink animate-in fade-in slide-in-from-bottom-6 duration-[var(--duration-slow)] ease-[var(--ease-smooth-out)]">
      <div className="shrink-0 border-b border-sd-line bg-sd-surface pt-[env(safe-area-inset-top)]">
        <div className="relative flex h-14 items-center justify-between px-4">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-ml-2.5 grid h-11 w-11 place-items-center oak-motion-control active:scale-90"
          >
            <X size={22} className="text-sd-ink-muted" />
          </button>
          <span className="absolute left-1/2 -translate-x-1/2 text-[17px] font-semibold">
            {existing ? "Edit code" : "New code"}
          </span>
          <span className="w-11" />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto overscroll-contain px-4 py-5">
        <section>
          <label htmlFor="discount-code" className="mb-1 block text-[19px] font-semibold">
            Code
          </label>
          <p className="mb-3 text-[14px] text-sd-ink-muted">
            What buyers type at checkout. Letters, numbers and dashes.
          </p>
          <div className="flex gap-2">
            <input
              id="discount-code"
              value={code}
              onChange={(e) => setCode(normaliseCode(e.target.value))}
              placeholder="SUMMER25"
              maxLength={24}
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className={`min-w-0 flex-1 rounded-2xl border bg-sd-surface px-4 py-3.5 text-[17px] font-semibold tracking-[0.04em] outline-none placeholder:font-normal placeholder:tracking-normal placeholder:text-sd-ink-faint focus:border-sd-ink-faint ${ring(errors.code)}`}
            />
            <button
              type="button"
              onClick={() => setCode(generateCode({ prefix: store?.brand_name }))}
              className="flex h-[54px] shrink-0 items-center gap-1.5 rounded-2xl bg-sd-soft px-4 text-[15px] font-medium oak-motion-control active:scale-[0.97]"
            >
              <Shuffle size={17} />
              Generate
            </button>
          </div>
          {err(errors.code)}
        </section>

        <section>
          <p className="mb-3 text-[19px] font-semibold">Discount</p>
          <div
            role="radiogroup"
            aria-label="Discount type"
            className="grid grid-cols-2 gap-1 rounded-full bg-sd-soft p-1"
          >
            {(
              [
                ["percent", "Percentage"],
                ["fixed", "Fixed amount"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={`h-10 rounded-full text-[15px] font-medium transition-colors duration-150 ${
                  kind === k ? "bg-sd-surface text-sd-ink shadow-sm" : "text-sd-ink-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {kind === "percent" ? (
            <>
              <div
                className={`mt-3 flex items-center rounded-2xl border px-4 focus-within:border-sd-ink-faint ${ring(errors.value)}`}
              >
                <input
                  aria-label="Percentage off"
                  value={percent}
                  onChange={(e) => setPercent(e.target.value.replace(/\D/g, "").slice(0, 2))}
                  placeholder="20"
                  inputMode="numeric"
                  className="min-w-0 flex-1 bg-transparent py-3.5 text-[17px] outline-none placeholder:text-sd-ink-faint"
                />
                <span className="text-[17px] text-sd-ink-muted">% off</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {PERCENT_PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPercent(String(p))}
                    className={`h-10 rounded-full px-4 text-[14px] font-medium oak-motion-control active:scale-[0.97] ${
                      percent === String(p) ? "bg-sd-ink text-sd-bg" : "bg-sd-soft text-sd-ink"
                    }`}
                  >
                    {p}%
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div
              className={`mt-3 flex items-center rounded-2xl border px-4 focus-within:border-sd-ink-faint ${ring(errors.value)}`}
            >
              <span className="text-[17px] text-sd-ink-muted">₦</span>
              <input
                aria-label="Amount off"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
                placeholder="2,000"
                inputMode="decimal"
                className="min-w-0 flex-1 bg-transparent py-3.5 pl-1 text-[17px] outline-none placeholder:text-sd-ink-faint"
              />
              <span className="text-[17px] text-sd-ink-muted">off</span>
            </div>
          )}
          {err(errors.value)}
        </section>

        <section>
          <label htmlFor="discount-min" className="mb-1 block text-[19px] font-semibold">
            Minimum order
          </label>
          <p className="mb-3 text-[14px] text-sd-ink-muted">
            The item total a buyer needs before the code works. Delivery doesn't count.
          </p>
          <div
            className={`flex items-center rounded-2xl border px-4 focus-within:border-sd-ink-faint ${ring(errors.minOrder)}`}
          >
            <span className="text-[17px] text-sd-ink-muted">₦</span>
            <input
              id="discount-min"
              value={minOrder}
              onChange={(e) => setMinOrder(e.target.value.replace(/[^\d.,]/g, ""))}
              placeholder="No minimum"
              inputMode="decimal"
              className="min-w-0 flex-1 bg-transparent py-3.5 pl-1 text-[17px] outline-none placeholder:text-sd-ink-faint"
            />
          </div>
          {err(errors.minOrder)}
          {freeOrderRisk && amountKobo != null && (
            <p className="mt-1.5 text-[13px] leading-snug text-sd-attention-ink">
              Orders under {formatKobo(amountKobo)} would cost the buyer nothing but delivery. Set a
              minimum of at least that to avoid it.
            </p>
          )}
        </section>

        <section>
          <p className="mb-3 text-[19px] font-semibold">Schedule</p>
          <div className="divide-y divide-sd-line rounded-2xl border border-sd-line px-4">
            <DateTimeField
              label="Starts"
              emptyLabel="Right away"
              value={startsAt}
              onChange={setStartsAt}
            />
            <DateTimeField
              label="Ends"
              emptyLabel="Never"
              value={endsAt}
              min={startsAt}
              onChange={setEndsAt}
            />
          </div>
          {err(errors.dates)}
        </section>

        <section>
          <label htmlFor="discount-limit" className="mb-1 block text-[19px] font-semibold">
            Usage limit
          </label>
          <p className="mb-3 text-[14px] text-sd-ink-muted">
            Total uses across all buyers.
            {usedCount > 0 && ` Used ${usedCount} time${usedCount === 1 ? "" : "s"} so far.`}
          </p>
          <input
            id="discount-limit"
            value={usageLimit}
            onChange={(e) => setUsageLimit(e.target.value.replace(/\D/g, "").slice(0, 7))}
            placeholder="Unlimited"
            inputMode="numeric"
            className={`w-full rounded-2xl border bg-sd-surface px-4 py-3.5 text-[17px] outline-none placeholder:text-sd-ink-faint focus:border-sd-ink-faint ${ring(errors.usageLimit)}`}
          />
          {err(errors.usageLimit)}
        </section>

        {preview && (
          <div className="rounded-2xl bg-sd-soft px-4 py-3.5 text-[14px] leading-relaxed text-sd-ink">
            <p>
              Buyers get <span className="font-semibold">{preview}</span>.
            </p>
            <p className="text-sd-ink-muted">
              {startsAt ? `From ${when(startsAt)}` : "Starts as soon as you save"}
              {endsAt ? `, until ${when(endsAt)}` : ", with no end date"}
              {limit ? `, up to ${limit} use${limit === 1 ? "" : "s"}` : ""}.
            </p>
          </div>
        )}

        {showRemove && (
          <div>
            <button
              type="button"
              onClick={() => void remove()}
              disabled={removing}
              className={`h-12 w-full rounded-full border text-[15px] font-semibold oak-motion-control active:scale-[0.98] disabled:opacity-50 ${
                confirmRemove
                  ? "border-sd-danger-mark bg-sd-danger-mark text-sd-on-accent"
                  : "border-sd-line text-sd-danger-ink"
              }`}
            >
              {removing ? "Working…" : removeLabel}
            </button>
            {usedCount > 0 && (
              <p className="mt-2 text-center text-[13px] text-sd-ink-muted">
                Used on {usedCount} order{usedCount === 1 ? "" : "s"}, so it stays on your list for
                your records.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-sd-line bg-sd-surface px-4 pt-3 oak-safe-bottom">
        {saveError && (
          <p className="mb-2 text-center text-[13px] text-sd-danger-ink" role="alert">
            {saveError}
          </p>
        )}
        {showErrors && hasErrors && !saveError && (
          <p className="mb-2 text-center text-[13px] text-sd-danger-ink">
            Fix the fields marked above.
          </p>
        )}
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || removing}
          className="w-full rounded-full bg-sd-ink py-4 text-[17px] font-semibold text-sd-bg oak-motion-control active:scale-[0.98] disabled:opacity-50"
        >
          {saving ? "Saving…" : existing ? "Save changes" : "Create code"}
        </button>
      </div>
    </div>
  );
}
