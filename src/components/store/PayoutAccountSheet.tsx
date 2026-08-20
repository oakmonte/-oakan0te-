import { useState } from "react";
import { X } from "lucide-react";
import { useLockedViewport } from "@/hooks/use-locked-viewport";

const BANK_PRESETS = [
  "Access Bank",
  "GTBank",
  "Zenith Bank",
  "UBA",
  "First Bank",
  "Kuda",
  "Opay",
  "Moniepoint",
  "Sterling Bank",
  "Fidelity Bank",
];

type PayoutFormValues = { bankName: string; accountNumber: string; accountName: string };

export function PayoutAccountSheet({
  initial,
  onSave,
  onClose,
}: {
  initial: PayoutFormValues | null;
  onSave: (values: PayoutFormValues) => Promise<void>;
  onClose: () => void;
}) {
  useLockedViewport();

  const [bankName, setBankName] = useState(initial?.bankName ?? "");
  const [accountNumber, setAccountNumber] = useState(initial?.accountNumber ?? "");
  const [accountName, setAccountName] = useState(initial?.accountName ?? "");
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const validAccountNumber = accountNumber.trim().length >= 10;
  const valid = bankName.trim().length > 0 && validAccountNumber && accountName.trim().length > 0;

  async function handleSave() {
    if (!valid) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    try {
      await onSave({
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        accountName: accountName.trim(),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col min-h-dvh animate-in fade-in slide-in-from-bottom-6 duration-300 ease-out">
      <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 px-4 h-14 flex items-center justify-between shrink-0">
        <button onClick={onClose} type="button" className="p-1 -ml-1">
          <X size={20} className="text-gray-500" />
        </button>
        <span className="font-semibold text-[15px] absolute left-1/2 -translate-x-1/2">
          Payout account
        </span>
        <span className="w-5" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-6">
        <div>
          <p className="text-[15px] font-semibold text-gray-900 mb-1">Bank name</p>
          <p className="text-xs text-gray-400 mb-3">Pick one or type your own.</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {BANK_PRESETS.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBankName(b)}
                className={`text-sm rounded-full px-3 py-1.5 border transition-colors duration-150 ${
                  bankName === b
                    ? "bg-black text-white border-black"
                    : "border-gray-200 text-gray-700"
                }`}
              >
                {b}
              </button>
            ))}
          </div>
          <input
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            placeholder="Bank name"
            className={`w-full text-base border rounded-xl px-4 py-3 outline-none focus:border-gray-400 transition-colors duration-150 ${
              showErrors && !bankName.trim() ? "border-red-300" : "border-gray-200"
            }`}
          />
        </div>

        <div>
          <p className="text-[15px] font-semibold text-gray-900 mb-3">Account number</p>
          <input
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
            placeholder="0123456789"
            inputMode="numeric"
            className={`w-full text-base border rounded-xl px-4 py-3 outline-none focus:border-gray-400 transition-colors duration-150 ${
              showErrors && !validAccountNumber ? "border-red-300" : "border-gray-200"
            }`}
          />
          {showErrors && !validAccountNumber && (
            <p className="text-xs text-red-500 mt-1">Enter a 10-digit account number.</p>
          )}
        </div>

        <div>
          <p className="text-[15px] font-semibold text-gray-900 mb-3">Account name</p>
          <input
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            placeholder="Name on the account"
            className={`w-full text-base border rounded-xl px-4 py-3 outline-none focus:border-gray-400 transition-colors duration-150 ${
              showErrors && !accountName.trim() ? "border-red-300" : "border-gray-200"
            }`}
          />
        </div>

        <p className="text-xs text-gray-400">
          We can&apos;t verify account details yet — that&apos;s coming once Paystack is connected.
          Your info is safely stored and only used to set up payouts.
        </p>
      </div>

      <div className="sticky bottom-0 px-4 py-3 border-t border-gray-100 bg-white shrink-0">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-black text-white text-sm font-medium rounded-full py-3.5 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save payout details"}
        </button>
      </div>
    </div>
  );
}
