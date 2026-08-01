import { Link } from "@tanstack/react-router";
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

export function BottomNav({ active, ownUsername }: BottomNavProps) {
  const items: { key: NavKey; label: string; icon: string; to: string; params?: Record<string, string> }[] = [
    { key: "home", label: "Home", icon: homeIcon, to: "/" },
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

  return (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50" style={{ width: 283, height: 49 }}>
      <div
        className="w-full h-full flex items-center justify-between"
        style={{
          padding: "13px 27px",
          borderRadius: 24,
          background: "rgba(255, 255, 255, 0.07)",
          backgroundBlendMode: "screen",
          boxShadow: "0px 8px 40px rgba(0, 0, 0, 0.20), inset 0 1px 0 rgba(255,255,255,0.25)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          border: "1px solid rgba(255,255,255,0.12)",
        }}
      >
        {items.map(({ key, label, icon, to, params }) => {
          const isActive = key === active;
          return (
            <Link
              key={key}
              to={to}
              params={params}
              aria-label={label}
              className="relative flex items-center justify-center transition-transform duration-150 active:scale-90"
              style={{ width: 32, height: 32 }}
            >
              {/* soft background capsule behind the active icon, not a glow on the icon itself */}
              <span
                className="absolute inset-0 rounded-full transition-all duration-200"
                style={{
                  background: isActive ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0)",
                  transform: isActive ? "scale(1)" : "scale(0.6)",
                }}
              />
              <img
                src={icon}
                alt=""
                className="relative transition-opacity duration-200"
                style={{ width: 21, height: 20, opacity: isActive ? 1 : 0.55 }}
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}