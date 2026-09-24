import walletIcon from "@/assets/wallet.svg";
import searchIconAsset from "@/assets/search.svg";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { animate, motion, useMotionValue, useTransform, useVelocity } from "framer-motion";
import { GLASS_RIM, glassLens, glassLight } from "@/lib/liquid-glass";

type TopToggleNavProps = {
  active: "shop" | "explore";
  onChange: (value: "shop" | "explore") => void;
  onWalletClick?: () => void;
  onSearchClick?: () => void;
  searchIcon?: ReactNode;
};

const glassButtonStyle: CSSProperties = {
  ...glassLight,
  width: 44,
  height: 44,
  position: "relative",
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
      className={`flex items-center justify-center rounded-full transition-transform duration-200 active:scale-90 ${GLASS_RIM}`}
      style={glassButtonStyle}
    >
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

  // Same liquid lens as the bottom nav: sprung, and stretched along its
  // direction of travel by its own velocity.
  const x = useMotionValue(activeIndex * tabWidth);
  const velocity = useVelocity(x);
  const scaleX = useTransform(velocity, [-2000, 0, 2000], [1.22, 1, 1.22]);
  const scaleY = useTransform(velocity, [-2000, 0, 2000], [0.88, 1, 0.88]);
  const lastIndex = useRef(activeIndex);
  useEffect(() => {
    const to = activeIndex * tabWidth;
    // First placement and re-measures just set it; only a real switch travels.
    if (lastIndex.current === activeIndex && x.getVelocity() === 0) {
      x.jump(to);
      return;
    }
    lastIndex.current = activeIndex;
    const controls = animate(x, to, { type: "spring", stiffness: 420, damping: 32, mass: 0.9 });
    return () => controls.stop();
  }, [activeIndex, tabWidth, x]);

  return (
    <div className="flex items-center justify-between" style={{ width: 358 }}>
      <div
        ref={trackRef}
        className={`relative flex items-center ${GLASS_RIM}`}
        style={{ ...glassLight, width: 208, height: 52, padding: PADDING, borderRadius: 999 }}
      >
        <motion.span
          aria-hidden
          className={GLASS_RIM}
          style={{
            ...glassLens,
            x,
            scaleX,
            scaleY,
            position: "absolute",
            top: PADDING,
            left: PADDING,
            width: tabWidth,
            height: 52 - PADDING * 2,
            borderRadius: 999,
            willChange: "transform",
          }}
        />

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
          {searchIcon ?? <img src={searchIconAsset} alt="" style={{ width: 18, height: 18 }} />}
        </GlassIconButton>
      </div>
    </div>
  );
}
