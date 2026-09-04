import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
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
const NAV_HEIGHT = 60;

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
  const [colWidth, setColWidth] = useState(58);

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
      style={{ width: 320, height: NAV_HEIGHT, bottom: 12 }}
    >
      <div
        ref={trackRef}
        className="relative flex items-center w-full h-full"
        style={{
          padding: PADDING,
          borderRadius: 999,
          background: "rgba(255,255,255,0.34)",
          border: "1px solid rgba(255,255,255,0.58)",
          boxShadow:
            "0 18px 46px rgba(0,0,0,0.28), 0 4px 12px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.72), inset 0 -1px 3px rgba(0,0,0,0.05)",
          backdropFilter: "blur(30px) saturate(195%)",
          WebkitBackdropFilter: "blur(30px) saturate(195%)",
        }}
      >
        {/* top-edge specular highlight */}
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
              "linear-gradient(180deg, rgba(255,255,255,0.58), rgba(255,255,255,0))",
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
              "linear-gradient(0deg, rgba(255,255,255,0.20), rgba(255,255,255,0))",
            filter: "blur(2px)",
            pointerEvents: "none",
          }}
        />

        {/* sliding glass lens — spring physics for a liquid, momentum feel */}
        <motion.span
          aria-hidden
          initial={false}
          animate={{
            x: activeIndex * colWidth,
            scale: 1,
          }}
          transition={{
            type: "spring",
            stiffness: 260,
            damping: 22,
            mass: 0.7,
          }}
          style={{
            position: "absolute",
            top: PADDING,
            left: PADDING,
            width: colWidth,
            height: NAV_HEIGHT - PADDING * 2,
            borderRadius: 999,
            background: "rgba(255,255,255,0.88)",
            border: "1px solid rgba(255,255,255,0.92)",
            boxShadow:
              "inset 0 1.5px 1px rgba(255,255,255,0.96), inset 0 -2px 5px rgba(0,0,0,0.08), 0 5px 18px rgba(0,0,0,0.20)",
            backdropFilter: "blur(18px) saturate(175%) brightness(1.07)",
            WebkitBackdropFilter: "blur(18px) saturate(175%) brightness(1.07)",
            transformOrigin: "center center",
            willChange: "transform",
          }}
        >
          {/* lens inner top streak */}
          <span
            style={{
              position: "absolute",
              top: 2,
              left: "18%",
              right: "18%",
              height: "38%",
              borderRadius: 999,
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0))",
              filter: "blur(1px)",
              pointerEvents: "none",
            }}
          />
        </motion.span>

        {items.map(({ key, label, icon, to, params }) => {
          const isActive = key === active;
          return (
            <Link
              key={key}
              to={to}
              params={params}
              aria-label={label}
              className="relative flex-1 flex items-center justify-center"
              style={{ zIndex: 1, height: "100%" }}
            >
              <motion.img
                src={icon}
                alt=""
                initial={false}
                animate={{
                  scale: isActive ? 1.18 : 1,
                  opacity: isActive ? 1 : 0.55,
                  y: isActive ? -1 : 0,
                }}
                transition={{
                  type: "spring",
                  stiffness: 320,
                  damping: 20,
                  mass: 0.6,
                }}
                style={{
                  width: 26,
                  height: 26,
                  filter: "brightness(0)",
                  willChange: "transform, opacity",
                }}
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
