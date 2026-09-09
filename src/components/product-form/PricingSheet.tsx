import { useState } from "react";
import { X, ChevronDown, XCircle } from "lucide-react";
import { useLockedViewport } from "@/hooks/use-locked-viewport";
import { cleanPriceDigits, displayPriceWithCommas, padPriceOnBlur } from "@/lib/format-price-input";

const COMMISSION_RATE = 0.045;
const PAYSTACK_RATE = 0.015;
const PAYSTACK_FLAT_FEE = 100;
const PAYSTACK_FLAT_FEE_THRESHOLD = 2500;
const PAYSTACK_FEE_CAP = 2000;

function formatNaira(n: number) {
  return `₦${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function computeFees(price: number) {
  const commission = price * COMMISSION_RATE;
  const hasFlatFee = price >= PAYSTACK_FLAT_FEE_THRESHOLD;
  let paystackFee = price * PAYSTACK_RATE + (hasFlatFee ? PAYSTACK_FLAT_FEE : 0);
  paystackFee = Math.min(paystackFee, PAYSTACK_FEE_CAP);
  return { commission, paystackFee, hasFlatFee, total: commission + paystackFee };
}

export function PricingSheet({
  price,
  compareAtPrice,
  costPrice,
  onChangePrice,
  onChangeCompareAtPrice,
  onChangeCostPrice,
  onClose,
}: {
  price: string;
  compareAtPrice: string;
  costPrice: string;
  onChangePrice: (v: string) => void;
  onChangeCompareAtPrice: (v: string) => void;
  onChangeCostPrice: (v: string) => void;
  onClose: () => void;
}) {
  useLockedViewport();

  const [breakdownOpen, setBreakdownOpen] = useState(false);

  const numPrice = parseFloat(price);
  const numCompareAt = parseFloat(compareAtPrice);
  const numCost = parseFloat(costPrice);
  const hasPrice = !isNaN(numPrice) && numPrice > 0;
  const hasCost = !isNaN(numCost) && numCost >= 0;
  const compareAtTooLow = hasPrice && !isNaN(numCompareAt) && numCompareAt < numPrice;

  const fees = hasPrice ? computeFees(numPrice) : null;
  const youReceive = hasPrice && fees ? numPrice - fees.total : null;
  const profit = hasPrice && hasCost && fees ? numPrice - numCost - fees.total : null;
  const margin = profit !== null && hasPrice ? (profit / numPrice) * 100 : null;

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
        <PriceBox label="Price" value={price} onChange={onChangePrice} autoFocus />
        <p className="text-xs text-gray-400 mt-1.5 mb-5">
          That's all you need — everything below is optional.
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

        <div className="border border-gray-300 rounded-xl overflow-hidden grid grid-cols-2 divide-x divide-gray-300">
          <div className="p-3">
            <p className="text-xs text-gray-500 mb-1">You'll receive</p>
            <p className="text-[15px] font-medium text-gray-900">
              {youReceive !== null ? formatNaira(youReceive) : "–"}
            </p>
          </div>
          <div className="p-3">
            <p className="text-xs text-gray-500 mb-1">Profit</p>
            {profit !== null ? (
              <p className="text-[15px] font-medium text-gray-900">{formatNaira(profit)}</p>
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

        {hasPrice && fees && (
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
                <FeeLine label="Price" value={formatNaira(numPrice)} />
                <FeeLine
                  label="Oakmonte commission (4.5%)"
                  value={`– ${formatNaira(fees.commission)}`}
                />
                <FeeLine
                  label={`Paystack Payment Processing (1.5%${fees.hasFlatFee ? "+₦100" : ""})`}
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

      <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-gray-300 px-4 py-3">
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
      <span className={bold ? "font-medium text-gray-900" : "text-gray-700"}>{value}</span>
    </div>
  );
}
