import type { ComponentType } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Download, MapPin, Palette, Plus, Share2, Wallet } from "lucide-react";
import { Eyebrow } from "./sections";

type Action = {
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  run: () => void;
};

/** Six tiles, three across. At 375px each is about 109px wide, which is
 *  comfortable for a 19px icon over a two-word label at 11px.
 *
 *  Store themes and Pickup locations are here on purpose. Both were previously
 *  reachable ONLY through the setup checklist -- neither has ever been in the
 *  drawer's NAV_ITEMS -- so replacing the checklist with this dashboard would
 *  have made two finished features unreachable. They are also added to the
 *  drawer in the same change: Quick Actions is a home-screen convenience, the
 *  drawer is the stable path, and a feature that exists in only the former
 *  disappears the next time the home screen is rearranged. */
export function QuickActions({
  onOpenLocations,
  onShare,
}: {
  onOpenLocations: () => void;
  onShare: () => void;
}) {
  const navigate = useNavigate();

  const actions: Action[] = [
    {
      label: "Add product",
      icon: Plus,
      run: () => navigate({ to: "/store/products/new" }),
    },
    {
      label: "Import catalogue",
      icon: Download,
      run: () => navigate({ to: "/store/products/upload" }),
    },
    {
      label: "Store themes",
      icon: Palette,
      run: () => navigate({ to: "/store/theme" }),
    },
    {
      // A sheet, not a route -- there is no /store/locations route, only
      // /store/locations/new. The list has always lived in a sheet.
      label: "Pickup locations",
      icon: MapPin,
      run: onOpenLocations,
    },
    {
      label: "Payout account",
      icon: Wallet,
      run: () => navigate({ to: "/store/finance" }),
    },
    {
      label: "Share link",
      icon: Share2,
      run: onShare,
    },
  ];

  return (
    <section>
      <Eyebrow>Quick actions</Eyebrow>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {actions.map(({ label, icon: Icon, run }) => (
          <button
            key={label}
            type="button"
            onClick={run}
            className="flex aspect-[1/0.92] flex-col items-center justify-center gap-2 rounded-xl border border-sd-line bg-sd-surface px-1 text-center oak-motion-control active:scale-[0.96]"
          >
            <Icon size={19} className="text-sd-ink-muted" />
            <span className="text-[11px] font-semibold leading-tight text-sd-ink">{label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
