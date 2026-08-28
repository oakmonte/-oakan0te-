import { useMemo, useState } from "react";
import { Check, Plus, Search, X } from "lucide-react";
import { useLockedViewport } from "@/hooks/use-locked-viewport";

// Every Nigeria bank/fintech Paystack supports transfers to — pulled from
// their public `GET /bank?country=nigeria` endpoint (active + supports_transfer
// only), not hand-picked. Long and includes a lot of MFBs by design: sellers
// bank with all of these, and we can't verify against Paystack yet anyway
// (see store.finance.tsx), so the full list is what "type your own" would
// have needed to cover regardless.
const NIGERIAN_BANKS = [
  "5TT MFB",
  "78 Finance Company Ltd",
  "9jaPay Microfinance Bank",
  "9mobile 9Payment Service Bank",
  "Abbey Mortgage Bank",
  "Above Only MFB",
  "Abulesoro MFB",
  "Access Bank",
  "Access Bank (Diamond)",
  "Accion Microfinance Bank",
  "Advancly MFB",
  "Aella MFB",
  "AG Mortgage Bank",
  "Ahmadu Bello University Microfinance Bank",
  "Airtel Smartcash PSB",
  "AKU Microfinance Bank",
  "Akuchukwu Microfinance Bank Limited",
  "Al-Barakah Microfinance Bank",
  "ALAT by WEMA",
  "Alert MFB",
  "ALLWORKERS MFB",
  "Alpha Morgan Bank",
  "Alternative bank",
  "Amju Unique MFB",
  "Aramoko MFB",
  "ASO Savings and Loans",
  "Assets Microfinance Bank",
  "Astrapolaris MFB LTD",
  "AVUENEGBE MICROFINANCE BANK",
  "AWACASH MICROFINANCE BANK",
  "AZTEC MICROFINANCE BANK LIMITED",
  "Bainescredit MFB",
  "Banc Corp Microfinance Bank",
  "Bank78 Microfinance Bank",
  "BANKIT MFB",
  "BANKIT MICROFINANCE BANK LTD",
  "BANKLY MFB",
  "Baobab Microfinance Bank",
  "BellBank Microfinance Bank",
  "Benysta Microfinance Bank Limited",
  "Berachah Microfinance Bank Ltd.",
  "Beststar Microfinance Bank",
  "BOLD MFB",
  "Boost Microfinance Bank",
  "Bosak Microfinance Bank",
  "Bowen Microfinance Bank",
  "Branch International Finance Company Limited",
  "Brent Mortgage bank",
  "BuyPower MFB",
  "Carbon",
  "Cashbridge Microfinance Bank Limited",
  "CASHCONNECT MFB",
  "Cedrus MFB",
  "CEMCS Microfinance Bank",
  "Centrum Finance",
  "Chanelle Microfinance Bank Limited",
  "Chikum Microfinance bank",
  "Citibank Nigeria",
  "CITYCODE MORTAGE BANK",
  "Consumer Microfinance Bank",
  "Cool Microfinance Bank Limited",
  "Corestep MFB",
  "Coronation Merchant Bank",
  "County Finance Limited",
  "Credit Direct Limited",
  "Crescent MFB",
  "Crust Microfinance Bank",
  "CRUTECH MICROFINANCE BANK LTD",
  "Dash Microfinance Bank",
  "Davenport MICROFINANCE BANK",
  "Dillon Microfinance Bank",
  "Dot Microfinance Bank",
  "EBSU Microfinance Bank",
  "Ecobank Nigeria",
  "Ekimogun MFB",
  "Ekondo Microfinance Bank",
  "ESO-E MICROFINANCE BANK LIMITED",
  "Ethica MFB",
  "EXCEL FINANCE BANK",
  "Eyowo",
  "Fairmoney Microfinance Bank",
  "FCMB MFB",
  "Fedeth MFB",
  "Fewchore Finance Company Limited",
  "FFS Microfinance Bank",
  "Fidelity Bank",
  "Firmus MFB",
  "First Bank of Nigeria",
  "First City Monument Bank",
  "FIRST ROYAL MICROFINANCE BANK",
  "FIRSTMIDAS MFB",
  "FirstTrust Mortgage Bank Nigeria",
  "Flutterwave MFB",
  "Fortress MFB",
  "FSDH Merchant Bank Limited",
  "FUTMINNA MICROFINANCE BANK",
  "Garun Mallam MFB",
  "Gateway Mortgage Bank LTD",
  "Globus Bank",
  "Goldman MFB",
  "GoMoney",
  "GOOD SHEPHERD MICROFINANCE BANK",
  "Goodnews Microfinance Bank",
  "Greenwich Merchant Bank",
  "GROOMING MICROFINANCE BANK",
  "GTI MFB",
  "Guaranty Trust Bank",
  "Hackman Microfinance Bank",
  "Haggai Mortgage Bank",
  "Hasal Microfinance Bank",
  "Hayat Trust MFB",
  "HopePSB",
  "IBANK Microfinance Bank",
  "IBBU MFB",
  "Ibile Microfinance Bank",
  "Ibom Mortgage Bank",
  "Ikoyi Osun MFB",
  "Ilaro Poly Microfinance Bank",
  "Imowo MFB",
  "IMPERIAL HOMES MORTAGE BANK",
  "Infinity MFB",
  "Infinity trust Mortgage Bank",
  "ISUA MFB",
  "Jaiz Bank",
  "Jubilee Life Mortgage Bank",
  "Kadpoly MFB",
  "KANOPOLY MFB",
  "Kayvee Microfinance Bank",
  "Keystone Bank",
  "Kolomoni MFB",
  "KONGAPAY (Kongapay Technologies Limited)(formerly Zinternet)",
  "Kredi Money MFB LTD",
  "Kuda Bank",
  "Lagos Building Investment Company Plc.",
  "Lemmy MFB",
  "Letshego Microfinance Bank",
  "Links MFB",
  "Living Trust Mortgage Bank",
  "LOMA MFB",
  "Lotus Bank",
  "Maal MFB",
  "MAINSTREET MICROFINANCE BANK",
  "Mayden Microfinance Bank",
  "Mayfair MFB",
  "Mega Microfinance Bank",
  "Mint MFB",
  "MINT-FINEX MFB",
  "Money Master PSB",
  "Moniepoint MFB",
  "MTN Momo PSB",
  "MUTUAL BENEFITS MICROFINANCE BANK",
  "NDCC MICROFINANCE BANK",
  "NET MICROFINANCE BANK",
  "Nigerian Navy Microfinance Bank Limited",
  "NIRSAL MICROFINANCE",
  "Nombank MFB",
  "NOVA BANK",
  "Novus MFB",
  "NPF MICROFINANCE BANK",
  "NSUK MICROFINANACE BANK",
  "NUVION MFB",
  "Olabisi Onabanjo University Microfinance Bank",
  "OLUCHUKWU MICROFINANCE BANK LTD",
  "OPay Digital Services Limited (OPay)",
  "Optimus Bank Limited",
  "Pact Microfinance Bank",
  "Paga",
  "PalmPay",
  "Parallex Bank",
  "Parkway - ReadyCash",
  "PATHFINDER MICROFINANCE BANK LIMITED",
  "Paystack MFB",
  "Paystack-Titan",
  "Peace Microfinance Bank",
  "PECANTRUST MICROFINANCE BANK LIMITED",
  "Personal Trust MFB",
  "Petra Mircofinance Bank Plc",
  "Pettysave MFB",
  "PFI FINANCE COMPANY LIMITED",
  "Platinum Mortgage Bank",
  "Pocket App",
  "Polaris Bank",
  "Polyunwana MFB",
  "PremiumTrust Bank",
  "Prospa Capital Microfinance Bank",
  "PROSPERIS FINANCE LIMITED",
  "Providus Bank",
  "QuickFund MFB",
  "Rand Merchant Bank",
  "RANDALPHA MICROFINANCE BANK",
  "Rank MFB",
  "Refuge Mortgage Bank",
  "REHOBOTH MICROFINANCE BANK",
  "Rephidim Microfinance Bank",
  "Retrust Mfb",
  "Rex Microfinance Bank",
  "Rigo Microfinance Bank Limited",
  "ROCKSHIELD MICROFINANCE BANK",
  "Rubies MFB",
  "Safe Haven MFB",
  "SAGE GREY FINANCE LIMITED",
  "Shield MFB",
  "Signature Bank Ltd",
  "Solid Allianze MFB",
  "Solid Rock MFB",
  "Sparkle Microfinance Bank",
  "SPECTRUM MFB LTD",
  "Springfield Microfinance Bank",
  "Stanbic IBTC Bank",
  "Standard Chartered Bank",
  "STANFORD MICROFINANCE BANK",
  "STATESIDE MICROFINANCE BANK",
  "STB Mortgage Bank",
  "Stellas MFB",
  "Sterling Bank",
  "Summit Bank",
  "Suntrust Bank",
  "Supreme MFB",
  "TAJ Bank",
  "Tangerine Money",
  "Tatum Bank",
  "TENN",
  "Think Finance Microfinance Bank",
  "Titan Bank",
  "TransPay MFB",
  "TRUSTBANC J6 MICROFINANCE BANK",
  "U and C MFB",
  "U&C Microfinance Bank Ltd (U AND C MFB)",
  "UBJ Microfinance Bank Limited",
  "UCEE MFB",
  "Uhuru MFB",
  "Ultraviolet Microfinance Bank",
  "Unaab Microfinance Bank Limited",
  "UNIABUJA MFB",
  "Unical MFB",
  "Unilag Microfinance Bank",
  "UNIMAID MICROFINANCE BANK",
  "Union Bank of Nigeria",
  "United Bank For Africa",
  "Unity Bank",
  "UNIUYO Microfinance Bank Ltd",
  "Uzondu Microfinance Bank Awka Anambra State",
  "Vale Finance Limited",
  "VFD Microfinance Bank Limited",
  "Victory MFB",
  "Waya Microfinance Bank",
  "Wema Bank",
  "Weston Charis MFB",
  "Whitecrust Finance Company",
  "Xpress Wallet",
  "YCT MFB",
  "Yes MFB",
  "Zap",
  "Zenith Bank",
  "Zitra MFB",
];

type PayoutFormValues = { bankName: string; accountNumber: string };

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
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  // Once a bank is picked the list collapses to just that row — tapping the
  // search bar again is the only way back into the full list, so re-picking
  // doesn't mean scrolling past every bank a second time.
  const [listOpen, setListOpen] = useState(!initial?.bankName);

  const validAccountNumber = accountNumber.trim().length >= 10;
  const valid = bankName.trim().length > 0 && validAccountNumber;

  const filteredBanks = useMemo(() => {
    const q = bankName.trim().toLowerCase();
    if (!q) return NIGERIAN_BANKS;
    return NIGERIAN_BANKS.filter((b) => b.toLowerCase().includes(q));
  }, [bankName]);

  const visibleBanks = listOpen ? filteredBanks : bankName.trim() ? [bankName.trim()] : [];

  function selectBank(b: string) {
    setBankName(b);
    setListOpen(false);
  }

  async function handleSave() {
    if (!valid) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    try {
      await onSave({ bankName: bankName.trim(), accountNumber: accountNumber.trim() });
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
          <p className="text-xs text-gray-500 mb-3">Pick one or type your own.</p>
          <div
            className={`flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 border transition-colors duration-150 ${
              showErrors && !bankName.trim() ? "border-red-300" : "border-transparent"
            }`}
          >
            <Search size={16} className="text-gray-400 shrink-0" />
            <input
              value={bankName}
              onChange={(e) => {
                setBankName(e.target.value);
                setListOpen(true);
              }}
              onFocus={() => setListOpen(true)}
              placeholder="Search banks"
              className="bg-transparent text-base flex-1 outline-none min-w-0"
            />
          </div>

          <div className="mt-2 max-h-56 overflow-y-auto border border-gray-300 rounded-xl">
            {visibleBanks.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-400 text-center">
                {listOpen ? "No matches — you can still use what you typed." : "No bank selected."}
              </p>
            ) : (
              visibleBanks.map((b) => {
                const isSelected = bankName === b;
                return (
                  <button
                    key={b}
                    type="button"
                    onClick={() => selectBank(b)}
                    aria-label={`Select ${b}`}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-50 last:border-0 text-left oak-motion-control"
                  >
                    <span
                      className={`text-[15px] text-gray-900 ${isSelected ? "font-medium" : ""}`}
                    >
                      {b}
                    </span>
                    {isSelected ? (
                      <Check size={16} className="text-black shrink-0 oak-motion-pop" />
                    ) : (
                      <Plus size={16} className="text-gray-400 shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
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

        <p className="text-xs text-gray-500">
          Kept private and encrypted — used only to send your payouts, never shared or shown to
          buyers.
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
