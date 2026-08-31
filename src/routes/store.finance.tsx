import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Landmark, Clock } from "lucide-react";
import { PayoutAccountSheet } from "@/components/store/PayoutAccountSheet";
import { authedFetch } from "@/lib/authed-fetch";

type PayoutAccount = {
  bank_name: string;
  account_number: string;
  status: string;
};

function maskAccountNumber(number: string) {
  if (number.length <= 4) return number;
  return `•••• ${number.slice(-4)}`;
}

export const Route = createFileRoute("/store/finance")({
  validateSearch: (search: Record<string, unknown>): { checklist?: boolean } => ({
    checklist: search.checklist === true || search.checklist === "true" ? true : undefined,
  }),
  component: FinancePage,
});

function FinancePage() {
  const navigate = useNavigate();
  const { checklist } = Route.useSearch();
  // undefined = still loading, null = no account saved yet
  const [account, setAccount] = useState<PayoutAccount | null | undefined>(undefined);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    authedFetch("/api/store/payout")
      .then((res) => res.json())
      .then((body) => {
        if (!cancelled) setAccount(body.account ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave(values: { bankName: string; accountNumber: string }) {
    const res = await authedFetch("/api/store/payout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const body = await res.json();
    if (res.ok) {
      setAccount(body.account);
      setSheetOpen(false);
    }
  }

  return (
    <div className="px-4 py-6">
      <h1 className="text-lg font-semibold mb-1">Finance</h1>
      <p className="text-sm text-gray-500 mb-6">
        Where your payouts go once your store starts selling.
      </p>

      {account === undefined && (
        <div className="border border-gray-100 rounded-2xl h-32 bg-gray-50 animate-pulse" />
      )}

      {account === null && (
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="w-full flex flex-col items-center gap-3 border border-dashed border-gray-200 rounded-2xl p-8 text-center oak-motion-control animate-in fade-in duration-300"
        >
          <div className="p-3 rounded-full bg-gray-100">
            <Landmark size={20} className="text-gray-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">Add your payout account</p>
            <p className="text-xs text-gray-500 mt-0.5">So we know where to send your money.</p>
          </div>
        </button>
      )}

      {account && (
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="w-full text-left bg-black text-white rounded-2xl p-5 flex flex-col gap-5 oak-motion-control animate-in fade-in duration-300"
        >
          <div className="flex items-center justify-between">
            <div className="p-2 rounded-full bg-white/10">
              <Landmark size={18} />
            </div>
            <span className="flex items-center gap-1.5 text-[11px] font-medium bg-amber-400/15 text-amber-300 rounded-full px-2.5 py-1">
              <Clock size={11} />
              Pending verification
            </span>
          </div>
          <div>
            <p className="text-lg font-mono tracking-wider">
              {maskAccountNumber(account.account_number)}
            </p>
            <p className="text-sm text-white/70 mt-1">{account.bank_name}</p>
          </div>
        </button>
      )}

      {account !== undefined && (
        <p className="text-xs text-gray-400 mt-4 animate-in fade-in duration-300">
          Actively verifying your account. If it is verified, this card flips to &quot;Verified&quot; automatically, no re-entry needed.
        </p>
      )}

      {sheetOpen && (
        <PayoutAccountSheet
          initial={
            account ? { bankName: account.bank_name, accountNumber: account.account_number } : null
          }
          onSave={handleSave}
          onClose={() => setSheetOpen(false)}
        />
      )}

      {checklist && (
        <div className="mt-8">
          <button
            type="button"
            onClick={() => navigate({ to: "/store" })}
            className="w-full bg-black text-white text-sm font-semibold rounded-full py-4 oak-motion-control active:scale-[0.98]"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
