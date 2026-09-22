import { LucideIcon } from "lucide-react";

/** The empty state for dashboard screens that have no data source yet --
 *  Orders, Customers, Growth, Discounts, Content.
 *
 *  Same voice as the dashboard's own empty states on purpose: a Fraunces
 *  headline over plain Inter copy. A seller who taps "Orders" from a dashboard
 *  whose Total sales card says "No sales yet." should land somewhere that
 *  sounds like the same product, not a generic grey placeholder. Fraunces is
 *  loaded by the /store route (store.tsx), so it is already available here. */
export function ComingSoonState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-16 text-center animate-in fade-in duration-300">
      <div className="rounded-full bg-sd-soft p-3">
        <Icon size={20} className="text-sd-ink-faint" />
      </div>
      <div>
        <p className="sd-editorial text-[18px] leading-snug text-sd-ink">{title}</p>
        <p className="mt-1.5 max-w-[260px] text-[13px] leading-relaxed text-sd-ink-muted">
          {description}
        </p>
      </div>
    </div>
  );
}
