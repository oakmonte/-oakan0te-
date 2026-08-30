import walletIcon from "@/assets/wallet.svg";
import searchIconAsset from "@/assets/search.svg";
import { useEffect, useRef, useState, type ReactNode } from "react";

type TopToggleNavProps = {
  active: "shop" | "explore";
  onChange: (value: "shop" | "explore") => void;
  onWalletClick?: () => void;
  onSearchClick?: () => void;
  searchIcon?: ReactNode;
};

const glassButtonStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  position: "relative",
  overflow: "hidden",
  background: "rgba(255,255,255,0.42)",
  border: "1px solid rgba(255,255,255,0.55)",
  boxShadow:
    "0 10px 30px rgba(0,0,0,0.25), 0 2px 6px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.7), inset 0 -1px 2px rgba(0,0,0,0.06)",
  backdropFilter: "blur(22px) saturate(180%)",
  WebkitBackdropFilter: "blur(22px) saturate(180%)",
};

function GlassIconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="flex items-center justify-center rounded-full transition-transform duration-200 active:scale-90"
      style={glassButtonStyle}
    >
      {/* top specular streak */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 2,
          left: "18%",
          right: "18%",
          height: "38%",
          borderRadius: 999,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0))",
          filter: "blur(1px)",
          pointerEvents: "none",
        }}
      />
      {children}
    </button>
  );
}

export function TopToggleNav({
  active,
  onChange,
  onWalletClick,
  onSearchClick,
  searchIcon,
}: TopToggleNavProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [tabWidth, setTabWidth] = useState(100);
  const PADDING = 4;

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const measure = () => {
      setTabWidth((el.clientWidth - PADDING * 2) / 2);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const activeIndex = active === "shop" ? 0 : 1;

  return (
    <div className="flex items-center justify-between" style={{ width: 358 }}>
      <div
        ref={trackRef}
        className="relative flex items-center"
        style={{
          width: 208,
          height: 52,
          padding: PADDING,
          borderRadius: 999,
          // deep translucent track — content beneath is blurred + saturated
          // through it, giving the "glass sits on the world" look
          background: "rgba(255,255,255,0.35)",
          border: "1px solid rgba(255,255,255,0.55)",
          boxShadow:
            "0 12px 36px rgba(0,0,0,0.28), 0 3px 8px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.7), inset 0 -1px 3px rgba(0,0,0,0.05)",
          backdropFilter: "blur(28px) saturate(190%)",
          WebkitBackdropFilter: "blur(28px) saturate(190%)",
        }}
      >
        {/* top-edge specular highlight — the "wet glass" rim light */}
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 2,
            left: "10%",
            right: "10%",
            height: "42%",
            borderRadius: 999,
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.5), rgba(255,255,255,0))",
            filter: "blur(1.5px)",
            pointerEvents: "none",
          }}
        />
        {/* faint bottom refraction glow */}
        <span
          aria-hidden
          style={{
            position: "absolute",
            bottom: 2,
            left: "20%",
            right: "20%",
            height: "30%",
            borderRadius: 999,
            background:
              "linear-gradient(0deg, rgba(255,255,255,0.18), rgba(255,255,255,0))",
            filter: "blur(2px)",
            pointerEvents: "none",
          }}
        />

        {/* sliding glass lens — its own blur+saturation pass makes content
            under it visibly "refract" as it moves */}
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: PADDING,
            left: PADDING,
            width: tabWidth,
            height: 52 - PADDING * 2,
            borderRadius: 999,
            background: "rgba(255,255,255,0.85)",
            border: "1px solid rgba(255,255,255,0.9)",
            boxShadow:
              "inset 0 1.5px 1px rgba(255,255,255,0.95), inset 0 -2px 4px rgba(0,0,0,0.08), 0 4px 14px rgba(0,0,0,0.22)",
            backdropFilter: "blur(16px) saturate(170%) brightness(1.06)",
            WebkitBackdropFilter: "blur(16px) saturate(170%) brightness(1.06)",
            transform: `translateX(${activeIndex * tabWidth}px)`,
            // springy, slightly overshooting ease for the liquid feel
            transition:
              "transform 480ms cubic-bezier(0.32, 1.4, 0.45, 1), width 480ms cubic-bezier(0.32, 1.4, 0.45, 1)",
          }}
        >
          {/* lens inner top streak */}
          <span
            style={{
              position: "absolute",
              top: 1.5,
              left: "14%",
              right: "14%",
              height: "40%",
              borderRadius: 999,
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.9), rgba(255,255,255,0))",
              filter: "blur(1px)",
              pointerEvents: "none",
            }}
          />
        </span>

        <button
          onClick={() => onChange("shop")}
          className="relative flex-1 text-center text-[16px] font-semibold transition-colors duration-300"
          style={{
            zIndex: 1,
            color: active === "shop" ? "#AB6501" : "#1A1A1A",
          }}
        >
          Shop
        </button>
        <button
          onClick={() => onChange("explore")}
          className="relative flex-1 text-center text-[16px] font-semibold transition-colors duration-300"
          style={{
            zIndex: 1,
            color: active === "explore" ? "#AB6501" : "#1A1A1A",
          }}
        >
          Explore
        </button>
      </div>

      <div className="flex items-center gap-4" style={{ width: 102 }}>
        <GlassIconButton label="Wallet" onClick={onWalletClick}>
          <img src={walletIcon} alt="" style={{ width: 18, height: 18 }} />
        </GlassIconButton>
        <GlassIconButton label="Search" onClick={onSearchClick}>
          {searchIcon ?? (
            <img src={searchIconAsset} alt="" style={{ width: 18, height: 18 }} />
          )}
        </GlassIconButton>
      </div>
    </div>
  );
}
