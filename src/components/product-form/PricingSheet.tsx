import { useEffect, useState } from "react";
import { X, ChevronDown, XCircle, Check } from "lucide-react";
import {
  computeUnitPrice,
  unitCategory,
  unitsForCategory,
  UNIT_ORDER,
  type Unit,
} from "@/lib/unit-pricing";

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
  let paystackFee =
    price * PAYSTACK_RATE + (price >= PAYSTACK_FLAT_FEE_THRESHOLD ? PAYSTACK_FLAT_FEE : 0);
  paystackFee = Math.min(paystackFee, PAYSTACK_FEE_CAP);
  return { commission, paystackFee, total: commission + paystackFee };
}

// Keeps at most one decimal point and 2 digits after it, stripping everything
// else — this is the raw value handed to onChange (no commas), so existing
// parseFloat() consumers elsewhere in the form don't need to change.
function cleanDigits(raw: string): string {
  let cleaned = raw.replace(/[^\d.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot !== -1) {
    cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
  }
  const dotIndex = cleaned.indexOf(".");
  if (dotIndex !== -1 && cleaned.length - dotIndex - 1 > 2) {
    cleaned = cleaned.slice(0, dotIndex + 3);
  }
  return cleaned;
}

// Adds thousands separators to the integer part while typing, without
// touching a decimal portion that's still being typed (so "20000.5" reads as
// "20,000.5", not forced to "20,000.50" until the field is done with).
function displayWithCommas(raw: string): string {
  if (!raw) return "";
  const [intPart, decPart] = raw.split(".");
  const commaInt = (intPart ? Number(intPart) : 0).toLocaleString("en-US");
  if (raw.includes(".")) return `${commaInt}.${decPart ?? ""}`;
  return commaInt;
}

// Pads to exactly 2 decimal places once the seller leaves the field.
function padOnBlur(raw: string): string {
  if (!raw) return raw;
  const [intPart, decPart] = raw.split(".");
  return `${intPart || "0"}.${(decPart ?? "").padEnd(2, "0").slice(0, 2)}`;
}

export function PricingSheet({
  price,
  compareAtPrice,
  costPrice,
  onChangePrice,
  onChangeCompareAtPrice,
  onChangeCostPrice,
  chargeSalesTax,
  onChangeChargeSalesTax,
  showUnitPrice,
  onChangeShowUnitPrice,
  unitTotalMeasurement,
  onChangeUnitTotalMeasurement,
  unitTotalUnit,
  onChangeUnitTotalUnit,
  unitBaseUnit,
  onChangeUnitBaseUnit,
  onClose,
}: {
  price: string;
  compareAtPrice: string;
  costPrice: string;
  onChangePrice: (v: string) => void;
  onChangeCompareAtPrice: (v: string) => void;
  onChangeCostPrice: (v: string) => void;
  chargeSalesTax: boolean;
  onChangeChargeSalesTax: (v: boolean) => void;
  showUnitPrice: boolean;
  onChangeShowUnitPrice: (v: boolean) => void;
  unitTotalMeasurement: string;
  onChangeUnitTotalMeasurement: (v: string) => void;
  unitTotalUnit: Unit;
  onChangeUnitTotalUnit: (v: Unit) => void;
  unitBaseUnit: Unit;
  onChangeUnitBaseUnit: (v: Unit) => void;
  onClose: () => void;
}) {
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  const numPrice = parseFloat(price);
  const numCost = parseFloat(costPrice);
  const hasPrice = !isNaN(numPrice) && numPrice > 0;
  const hasCost = !isNaN(numCost) && numCost >= 0;

  const fees = hasPrice ? computeFees(numPrice) : null;
  const youReceive = hasPrice && fees ? numPrice - fees.total : null;
  const profit = hasPrice && hasCost && fees ? numPrice - numCost - fees.total : null;
  const margin = profit !== null && hasPrice ? (profit / numPrice) * 100 : null;

  // The base unit has to stay in the same family as the total measurement's
  // unit (can't price "per lb" against a total given in "ft") — reset it
  // whenever a category-changing total-unit pick makes it stale.
  useEffect(() => {
    if (unitCategory(unitBaseUnit) !== unitCategory(unitTotalUnit)) {
      onChangeUnitBaseUnit(unitTotalUnit);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitTotalUnit]);

  const numTotalMeasurement = parseFloat(unitTotalMeasurement);
  const unitPrice =
    showUnitPrice && hasPrice && !isNaN(numTotalMeasurement)
      ? computeUnitPrice(numPrice, numTotalMeasurement, unitTotalUnit, unitBaseUnit)
      : null;

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
        <p className="text-xs text-gray-400 mt-1.5 mb-5">
          What the product would've cost without a discount — shown crossed out next to your actual
          price.
        </p>
        <PriceBox label="Cost per item" value={costPrice} onChange={onChangeCostPrice} />
        <p className="text-xs text-gray-400 mt-1.5 mb-5">Customers won't see this</p>

        <div className="border border-gray-300 rounded-xl overflow-hidden grid grid-cols-2 divide-x divide-gray-300">
          <div className="p-3">
            <p className="text-xs text-gray-500 mb-1">You'll receive</p>
            <p className="text-[15px] font-medium text-gray-900">
              {youReceive !== null ? formatNaira(youReceive) : "–"}
            </p>
          </div>
          <div className="p-3">
            <p className="text-xs text-gray-500 mb-1">Profit</p>
            <p className="text-[15px] font-medium text-gray-900">
              {profit !== null ? formatNaira(profit) : "–"}
            </p>
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
                  label="Payment processing (Paystack)"
                  value={`– ${formatNaira(fees.paystackFee)}`}
                />
                <div className="border-t border-gray-300 pt-2">
                  <FeeLine label="You'll receive" value={formatNaira(youReceive ?? 0)} bold />
                </div>
                {hasCost && (
                  <div className="border-t border-gray-300 pt-2">
                    <FeeLine label="Cost per item" value={`– ${formatNaira(numCost)}`} />
                    <FeeLine label="Profit" value={formatNaira(profit ?? 0)} bold />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mt-5 border-t border-gray-300 pt-1">
          <CheckboxRow
            label="Charge sales tax"
            checked={chargeSalesTax}
            onChange={onChangeChargeSalesTax}
          />
          <CheckboxRow
            label="Show unit price"
            checked={showUnitPrice}
            onChange={onChangeShowUnitPrice}
          />
        </div>

        {showUnitPrice && (
          <div className="mt-2 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-200 ease-out">
            <div className="flex items-center justify-between border border-gray-300 rounded-xl px-3 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 mb-1">Total product measurement</p>
                <input
                  type="text"
                  inputMode="decimal"
                  value={unitTotalMeasurement}
                  onChange={(e) =>
                    onChangeUnitTotalMeasurement(e.target.value.replace(/[^\d.]/g, ""))
                  }
                  placeholder="0"
                  className="text-base outline-none w-full min-w-0"
                />
              </div>
              <UnitSelect value={unitTotalUnit} onChange={onChangeUnitTotalUnit} />
            </div>

            <div className="flex items-center justify-between border border-gray-300 rounded-xl px-3 py-2.5 bg-gray-50">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 mb-1">Base measurement</p>
                <p className="text-base text-gray-400">1</p>
              </div>
              <UnitSelect
                value={unitBaseUnit}
                onChange={onChangeUnitBaseUnit}
                options={unitsForCategory(unitCategory(unitTotalUnit) ?? "count")}
              />
            </div>

            {unitPrice !== null && (
              <p className="text-xs text-gray-500">
                ≈ {formatNaira(unitPrice)} per {unitBaseUnit}
              </p>
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
    <label className="block border border-gray-300 rounded-xl px-3 py-2.5 mb-3">
      <span className="block text-xs text-gray-500 mb-1">{label}</span>
      <span className="flex items-center gap-1">
        <span className="text-base text-gray-500">₦</span>
        <input
          type="text"
          inputMode="decimal"
          value={displayWithCommas(value)}
          onChange={(e) => onChange(cleanDigits(e.target.value))}
          onBlur={() => value && onChange(padOnBlur(value))}
          autoFocus={autoFocus}
          placeholder="0.00"
          className="text-base flex-1 outline-none min-w-0"
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

function CheckboxRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="w-full flex items-center gap-3 py-2.5"
    >
      <span
        className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
          checked ? "bg-black border-black" : "border-gray-300"
        }`}
      >
        {checked && <Check size={13} className="text-white" />}
      </span>
      <span className="text-[15px] text-gray-900">{label}</span>
    </button>
  );
}

function UnitSelect({
  value,
  onChange,
  options = [...UNIT_ORDER],
}: {
  value: Unit;
  onChange: (v: Unit) => void;
  options?: Unit[];
}) {
  return (
    <div className="relative shrink-0 ml-2">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Unit)}
        className="appearance-none bg-gray-100 rounded-lg pl-2.5 pr-6 py-1.5 text-sm text-gray-900 outline-none"
      >
        {options.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
      </select>
      <ChevronDown
        size={12}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
      />
    </div>
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
