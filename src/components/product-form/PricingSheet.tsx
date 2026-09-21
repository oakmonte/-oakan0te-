import { useState } from "react";
import { X, ChevronDown, XCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useLockedViewport } from "@/hooks/use-locked-viewport";
import { cleanPriceDigits, displayPriceWithCommas, padPriceOnBlur } from "@/lib/format-price-input";
import {
  computeFees,
  formatNaira,
  grossUpForNet,
  COMMISSION_RATE,
  PAYSTACK_RATE,
} from "@/lib/pricing-fees";

const COMMISSION_PCT = `${(COMMISSION_RATE * 100).toFixed(1)}%`;
const PAYSTACK_PCT = `${(PAYSTACK_RATE * 100).toFixed(1)}%`;

export function PricingSheet({
  price,
  compareAtPrice,
  costPrice,
  passFeesToBuyer,
  onChangePrice,
  onChangeCompareAtPrice,
  onChangeCostPrice,
  onChangePassFeesToBuyer,
  onClose,
}: {
  price: string;
  compareAtPrice: string;
  costPrice: string;
  /** Product-level pricing policy — see the note on the toggle below. */
  passFeesToBuyer: boolean;
  onChangePrice: (v: string) => void;
  onChangeCompareAtPrice: (v: string) => void;
  onChangeCostPrice: (v: string) => void;
  onChangePassFeesToBuyer: (v: boolean) => void;
  onClose: () => void;
}) {
  useLockedViewport();

  const [breakdownOpen, setBreakdownOpen] = useState(false);

  const numPrice = parseFloat(price);
  const numCompareAt = parseFloat(compareAtPrice);
  const numCost = parseFloat(costPrice);
  const hasPrice = !isNaN(numPrice) && numPrice > 0;
  const hasCost = !isNaN(numCost) && numCost >= 0;

  // What the seller typed means one of two things, so everything downstream
  // has to be derived rather than read straight off the field.
  const charged = hasPrice ? (passFeesToBuyer ? grossUpForNet(numPrice) : numPrice) : null;
  const fees = charged !== null ? computeFees(charged) : null;
  const youReceive = charged !== null && fees ? charged - fees.total : null;
  const profit = youReceive !== null && hasCost ? youReceive - numCost : null;
  // Margin is against what the customer actually pays, which is the number the
  // seller is setting either way.
  const margin = profit !== null && charged ? (profit / charged) * 100 : null;

  // Compared against the CHARGED price, not the entered one: a compare-at is a
  // customer-facing number, so measuring it against the seller's take would
  // call a real discount fake whenever fees are passed on.
  const compareAtTooLow = charged !== null && !isNaN(numCompareAt) && numCompareAt < charged;

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col min-h-dvh animate-in fade-in slide-in-from-bottom-6 duration-300 ease-out">
      <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-300 px-4 h-14 flex items-center justify-between">
        <button onClick={onClose} type="button" className="p-1 -ml-1">
          <X size={20} className="text-gray-500" />
        </button>
        <span className="font-semibold text-[15px] absolute left-1/2 -translate-x-1/2">Price</span>
        <span className="w-5" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        {/* The field's label changes with the policy, because its meaning does.
            Leaving it as "Price" while it quietly means "your take" is how a
            seller ends up listing at a number they never intended. */}
        <PriceBox
          label={passFeesToBuyer ? "You receive" : "Price"}
          value={price}
          onChange={onChangePrice}
          autoFocus
        />
        <p className="text-xs text-gray-400 mt-1.5 mb-5">
          {passFeesToBuyer
            ? "What lands in your account. The customer is charged this plus the fees."
            : "That's all you need — everything below is optional."}
        </p>

        <PriceBox
          label="Compare-at price"
          value={compareAtPrice}
          onChange={onChangeCompareAtPrice}
        />
        <p className="text-xs text-gray-400 mt-1.5">
          What the product would've cost without a discount — shown crossed out next to your actual
          price.
        </p>
        {compareAtTooLow && (
          <p className="text-xs text-amber-600 mt-1">
            This is lower than the actual price, so it won't read as a discount.
          </p>
        )}
        <div className="mb-5" />

        <PriceBox label="Cost price" value={costPrice} onChange={onChangeCostPrice} />
        <p className="text-xs text-gray-400 mt-1.5 mb-5">
          Type in how much this product/variant cost you in order to measure your profit, customers
          won't see this.
        </p>

        {/* Its own block, like the inventory sheet's toggle — this is a policy
            decision, not another amount to type. */}
        <div className="-mx-4 h-2 bg-gray-50" />
        <div className="py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[15px] text-gray-900">Customer covers the fees</p>
              <p className="text-xs text-gray-500 mt-1">
                Your price stays whole. Oakmonte's {COMMISSION_PCT} and Paystack's {PAYSTACK_PCT}{" "}
                are added on top instead of coming out of it.
              </p>
            </div>
            <div className="pt-0.5 shrink-0">
              <Switch
                checked={passFeesToBuyer}
                onCheckedChange={onChangePassFeesToBuyer}
                aria-label="Customer covers the fees"
              />
            </div>
          </div>
          <p className="text-[11px] text-gray-400 mt-2">
            Applies to every variant of this product.
          </p>
        </div>
        <div className="-mx-4 h-2 bg-gray-50 mb-4" />

        {/* When fees are passed on, what the customer pays is the number that
            moved and the one worth checking, so it leads. */}
        {passFeesToBuyer && (
          <div className="border border-gray-900 rounded-xl p-3 mb-3">
            <p className="text-xs text-gray-500 mb-1">Customer pays</p>
            <p className="text-[22px] font-semibold text-gray-900 leading-tight tabular-nums">
              {charged !== null ? formatNaira(charged) : "–"}
            </p>
            {charged !== null && fees && (
              <p className="text-[11px] text-gray-500 mt-1">
                {formatNaira(charged - (youReceive ?? 0))} of fees added to your{" "}
                {formatNaira(numPrice)}
              </p>
            )}
          </div>
        )}

        <div className="border border-gray-300 rounded-xl overflow-hidden grid grid-cols-2 divide-x divide-gray-300">
          <div className="p-3">
            <p className="text-xs text-gray-500 mb-1">You'll receive</p>
            <p className="text-[15px] font-medium text-gray-900 tabular-nums">
              {youReceive !== null ? formatNaira(youReceive) : "–"}
            </p>
          </div>
          <div className="p-3">
            <p className="text-xs text-gray-500 mb-1">Profit</p>
            {profit !== null ? (
              <p className="text-[15px] font-medium text-gray-900 tabular-nums">
                {formatNaira(profit)}
              </p>
            ) : (
              <p className="text-xs text-gray-400 leading-snug">
                Measure your profit by inputting <span className="font-bold">cost price</span>
              </p>
            )}
            {margin !== null && (
              <p className="text-[11px] text-gray-400 mt-0.5">{margin.toFixed(1)}% margin</p>
            )}
          </div>
        </div>

        {charged !== null && fees && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setBreakdownOpen((v) => !v)}
              className="flex items-center gap-1 text-xs text-gray-500"
            >
              See where your money goes
              <ChevronDown
                size={13}
                className={`transition-transform duration-200 ${breakdownOpen ? "rotate-180" : ""}`}
              />
            </button>
            {breakdownOpen && (
              <div className="mt-2 border border-gray-300 rounded-lg p-3 flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-200 ease-out">
                {/* Always starts from what the customer is charged — that is
                    what both fees are actually taken from. */}
                <FeeLine
                  label={passFeesToBuyer ? "Customer pays" : "Price"}
                  value={formatNaira(charged)}
                />
                <FeeLine
                  label={`Oakmonte commission (${COMMISSION_PCT})`}
                  value={`– ${formatNaira(fees.commission)}`}
                />
                <FeeLine
                  label={`Paystack Payment Processing (${PAYSTACK_PCT}${
                    fees.hasFlatFee ? "+₦100" : ""
                  }${fees.isCapped ? ", capped" : ""})`}
                  value={`– ${formatNaira(fees.paystackFee)}`}
                />
                <div className="border-t border-gray-300 pt-2">
                  <FeeLine label="You'll receive" value={formatNaira(youReceive ?? 0)} bold />
                </div>
                {hasCost && (
                  <div className="border-t border-gray-300 pt-2">
                    <FeeLine label="Cost price" value={`– ${formatNaira(numCost)}`} />
                    <FeeLine label="Profit" value={formatNaira(profit ?? 0)} bold />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-gray-300 px-4 pt-3 oak-safe-bottom">
        <button
          type="button"
          onClick={onClose}
          className="w-full bg-black text-white text-sm font-medium rounded-xl py-3.5"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function PriceBox({
  label,
  value,
  onChange,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <label className="block border border-gray-400 bg-gray-50 rounded-xl px-3 py-2.5 mb-3">
      <span className="block text-xs text-gray-500 mb-1">{label}</span>
      <span className="flex items-center gap-1">
        <span className="text-base text-gray-500">₦</span>
        <input
          type="text"
          inputMode="decimal"
          value={displayPriceWithCommas(value)}
          onChange={(e) => onChange(cleanPriceDigits(e.target.value))}
          onBlur={() => value && onChange(padPriceOnBlur(value))}
          autoFocus={autoFocus}
          placeholder="0.00"
          className="text-base flex-1 outline-none min-w-0 bg-transparent"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label={`Clear ${label}`}
            className="shrink-0"
          >
            <XCircle size={18} className="text-gray-400" />
          </button>
        )}
      </span>
    </label>
  );
}

function FeeLine({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className={bold ? "font-medium text-gray-900" : "text-gray-500"}>{label}</span>
      <span
        className={bold ? "font-medium text-gray-900 tabular-nums" : "text-gray-700 tabular-nums"}
      >
        {value}
      </span>
    </div>
  );
}
