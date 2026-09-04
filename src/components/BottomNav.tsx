import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import homeIcon from "@/assets/Home.svg";
import messagesIcon from "@/assets/messages.svg";
import createIcon from "@/assets/create.svg";
import cartIcon from "@/assets/cart.svg";
import profileIcon from "@/assets/profile.svg";

type NavKey = "home" | "messages" | "create" | "cart" | "profile";

type BottomNavProps = {
  active: NavKey;
  ownUsername?: string;
};

const PADDING = 5;

export function BottomNav({ active, ownUsername }: BottomNavProps) {
  const items: {
    key: NavKey;
    label: string;
    icon: string;
    to: string;
    params?: Record<string, string>;
  }[] = [
    { key: "home", label: "Home", icon: homeIcon, to: "/home" },
    { key: "messages", label: "Messages", icon: messagesIcon, to: "/messages" },
    { key: "create", label: "Create", icon: createIcon, to: "/create" },
    { key: "cart", label: "Cart", icon: cartIcon, to: "/cart" },
    {
      key: "profile",
      label: "Profile",
      icon: profileIcon,
      to: "/profile/$username",
      params: ownUsername ? { username: ownUsername } : undefined,
    },
  ];

  const trackRef = useRef<HTMLDivElement>(null);
  const [colWidth, setColWidth] = useState(54);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const measure = () => {
      setColWidth((el.clientWidth - PADDING * 2) / items.length);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.key === active),
  );

  return (
    <nav
      className="fixed left-1/2 -translate-x-1/2 z-50"
      style={{ width: 300, height: 56, bottom: 10 }}
    >
      <div
        ref={trackRef}
        className="relative flex items-center w-full h-full"
        style={{
          padding: PADDING,
          borderRadius: 999,
          // deep translucent track — content beneath is blurred + saturated
          // through it, giving the "glass floats on the world" look
          background: "rgba(255,255,255,0.35)",
          border: "1px solid rgba(255,255,255,0.55)",
          boxShadow:
            "0 14px 40px rgba(0,0,0,0.30), 0 3px 10px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.7), inset 0 -1px 3px rgba(0,0,0,0.05)",
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
            left: "12%",
            right: "12%",
            height: "44%",
            borderRadius: 999,
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0))",
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
            left: "22%",
            right: "22%",
            height: "30%",
            borderRadius: 999,
            background:
              "linear-gradient(0deg, rgba(255,255,255,0.18), rgba(255,255,255,0))",
            filter: "blur(2px)",
            pointerEvents: "none",
          }}
        />

        {/* sliding glass lens — its own blur+saturation pass makes content
            under it visibly "refract" as it glides between icons */}
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: PADDING,
            left: PADDING,
            width: colWidth,
            height: 56 - PADDING * 2,
            borderRadius: 999,
            background: "rgba(255,255,255,0.85)",
            border: "1px solid rgba(255,255,255,0.9)",
            boxShadow:
              "inset 0 1.5px 1px rgba(255,255,255,0.95), inset 0 -2px 4px rgba(0,0,0,0.08), 0 4px 14px rgba(0,0,0,0.22)",
            backdropFilter: "blur(16px) saturate(170%) brightness(1.06)",
            WebkitBackdropFilter: "blur(16px) saturate(170%) brightness(1.06)",
            transform: `translateX(${activeIndex * colWidth}px)`,
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
              left: "16%",
              right: "16%",
              height: "40%",
              borderRadius: 999,
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.9), rgba(255,255,255,0))",
              filter: "blur(1px)",
              pointerEvents: "none",
            }}
          />
        </span>

        {items.map(({ key, label, icon, to, params }) => {
          const isActive = key === active;
          return (
            <Link
              key={key}
              to={to}
              params={params}
              aria-label={label}
              className="relative flex-1 flex items-center justify-center transition-transform duration-200 active:scale-90"
              style={{ zIndex: 1, height: "100%" }}
            >
              <img
                src={icon}
                alt=""
                className="transition-all duration-300"
                style={{
                  width: 21,
                  height: 20,
                  // icons are white artwork — darken them to sit on the light glass
                  filter: "brightness(0)",
                  opacity: isActive ? 1 : 0.5,
                  transform: isActive ? "scale(1.08)" : "scale(1)",
                }}
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
