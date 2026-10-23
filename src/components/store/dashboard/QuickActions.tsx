import type { ComponentType } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Download, Layers, MapPin, Plus, ShoppingBag, Tag } from "lucide-react";
import { SectionTitle } from "./sections";

type Action = {
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  run: () => void;
};

/** Six tiles, three across. At 375px each is about 109px wide.
 *
 *  Every tile goes somewhere nothing else on this page already goes. The first
 *  version carried Share (already a pill AND the hero's button -- three ways to
 *  do one thing, two of them opening different sheets), Store themes (the same
 *  page as the Edit store pill) and Payout account (the same page as the payout
 *  row). Duplicates make a page longer without making it more capable.
 *
 *  Pickup locations lives here and only here once setup is done: it is a sheet
 *  with no route, and it is deliberately NOT in the drawer (store-home only, by
 *  Diadem's call). Store themes is reached through the Edit store pill. Remove
 *  this tile and pickup locations become unreachable after onboarding. */
export function QuickActions({ onOpenLocations }: { onOpenLocations: () => void }) {
  const navigate = useNavigate();

  const actions: Action[] = [
    { label: "Add product", icon: Plus, run: () => navigate({ to: "/store/products" }) },
    {
      label: "Import products",
      icon: Download,
      run: () => navigate({ to: "/store/products/upload" }),
    },
    { label: "Pickup locations", icon: MapPin, run: onOpenLocations },
    { label: "Collections", icon: Layers, run: () => navigate({ to: "/store/collections" }) },
    { label: "Orders", icon: ShoppingBag, run: () => navigate({ to: "/store/orders" }) },
    { label: "Discounts", icon: Tag, run: () => navigate({ to: "/store/discounts" }) },
  ];

  return (
    <section aria-labelledby="sd-quick">
      <SectionTitle id="sd-quick">Quick actions</SectionTitle>
      {/* Six across on a wide screen at a fixed height: the phone's square-ish
          tiles, stretched to a third of a 1000px panel, were ~300px tall
          boxes with a small icon pinned to the top. */}
      <div className="mt-3 grid grid-cols-3 gap-2 md:grid-cols-6 md:gap-3">
        {actions.map(({ label, icon: Icon, run }) => (
          <button
            key={label}
            type="button"
            onClick={run}
            // Centred in the tile. The label always reserves two lines
            // (min-h), so "Pickup locations" wrapping at 360px doesn't lift
            // its icon above its single-line neighbours'.
            className="flex aspect-[1/0.8] flex-col items-center justify-center gap-1.5 rounded-xl border border-sd-line bg-sd-surface px-1 text-center oak-motion-control active:scale-[0.96] md:aspect-auto md:h-[104px]"
          >
            <Icon size={20} className="text-sd-ink" />
            <span className="min-h-[2.5em] text-[12px] font-semibold leading-tight text-sd-ink">
              {label}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
