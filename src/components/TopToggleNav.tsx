import searchIcon from "@/assets/search.svg";
import walletIcon from "@/assets/wallet.svg";

type TopToggleNavProps = {
  active: "shop" | "explore";
  onChange: (value: "shop" | "explore") => void;
  onWalletClick?: () => void;
  onSearchClick?: () => void;
};

export function TopToggleNav({ active, onChange, onWalletClick, onSearchClick }: TopToggleNavProps) {
  return (
    <div className="flex items-center justify-between" style={{ width: 358 }}>
      {/* Shop / Explore segmented pill */}
      <div
        className="relative flex items-center"
        style={{
          width: 208,
          height: 53,
          padding: "4px 3px",
          borderRadius: 296,
          background: "rgba(255,255,255,0.65)",
          boxShadow: "0px 8px 40px rgba(0,0,0,0.12)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
        }}
      >
        <span
          className="absolute rounded-full transition-transform duration-250 ease-out"
          style={{
            width: 102,
            height: 41,
            top: 6,
            left: active === "shop" ? 2 : 104,
            background: "#EDEDED",
          }}
        />
        <button
          onClick={() => onChange("shop")}
          className="relative flex-1 text-center text-[16px] font-semibold py-1.5"
          style={{ color: active === "shop" ? "#AB6501" : "#1A1A1A" }}
        >
          Shop
        </button>
        <button
          onClick={() => onChange("explore")}
          className="relative flex-1 text-center text-[16px] font-semibold py-1.5"
          style={{ color: active === "explore" ? "#AB6501" : "#1A1A1A" }}
        >
          Explore
        </button>
      </div>

      {/* Wallet + search buttons */}
      <div className="flex items-center gap-4" style={{ width: 102 }}>
        <button
          onClick={onWalletClick}
          aria-label="Wallet"
          className="flex items-center justify-center rounded-full transition-transform duration-150 active:scale-90"
          style={{
            width: 37,
            height: 35,
            background: "rgba(255,255,255,0.65)",
            boxShadow: "0px 8px 40px rgba(0,0,0,0.12)",
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
          }}
        >
          <img src={walletIcon} alt="" style={{ width: 18, height: 18 }} />
        </button>
        <button
          onClick={onSearchClick}
          aria-label="Search"
          className="flex items-center justify-center rounded-full transition-transform duration-150 active:scale-90"
          style={{
            width: 37,
            height: 35,
            background: "rgba(255,255,255,0.65)",
            boxShadow: "0px 8px 40px rgba(0,0,0,0.12)",
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
          }}
        >
          <img src={searchIcon} alt="" style={{ width: 18, height: 18 }} />
        </button>
      </div>
    </div>
  );
}