import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, ChevronRight, TrendingUp, Wallet } from "lucide-react";

/** The landing page's micro-label, blue dot and all. Reused rather than
 *  re-derived so the dashboard's section headings and the marketing site speak
 *  in the same voice. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="oak-eyebrow">{children}</p>;
}

/** A horizontally scrolling row of cards.
 *
 *  Native scroll snap rather than a hand-rolled gesture: the browser's own
 *  physics beat anything spring-driven here, and it stays interruptible for
 *  free. The negative margin plus matching padding lets cards bleed to the
 *  screen edge while still snapping back to the page gutter, and
 *  `touch-action: pan-y` stops the page juddering vertically while a thumb
 *  moves sideways. */
export function SnapRow({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain scroll-px-4 px-4 [touch-action:pan-y]">
      {children}
    </div>
  );
}

export function WhatsNew() {
  return (
    <section>
      <Eyebrow>What&apos;s new</Eyebrow>
      <div className="mt-3">
        <SnapRow>
          {/* Fixed height in the empty state too, so adding real content later
              does not reflow everything below it. */}
          <article className="flex h-[148px] w-[calc(100%-1.5rem)] shrink-0 snap-start flex-col justify-center rounded-2xl border border-dashed border-sd-line px-5">
            <p className="sd-editorial text-[18px] leading-snug text-sd-ink">Nothing new yet</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-sd-ink-muted">
              Product drops, payout changes and platform news will land here.
            </p>
          </article>
        </SnapRow>
      </div>
    </section>
  );
}

export type AttentionItem = {
  id: string;
  title: string;
  body: string;
  cta: string;
  to: string;
  severity: "attention" | "danger";
};

export function NeedsAttention({ items }: { items: AttentionItem[] }) {
  return (
    <section>
      <Eyebrow>Needs attention</Eyebrow>
      <div className="mt-3">
        {items.length === 0 ? (
          // The section does NOT collapse when it is empty. A section that only
          // appears when something is wrong is one the seller never learns
          // exists, and cannot learn to trust. Saying "all clear" is a real
          // answer; showing nothing is an absence they have to interpret.
          <div className="flex items-center gap-3 rounded-2xl bg-sd-accent-tint px-4 py-3.5">
            <CheckCircle2 size={18} className="shrink-0 text-sd-success-mark" />
            <p className="text-[13px] font-medium text-sd-ink">
              All clear — nothing needs you right now.
            </p>
          </div>
        ) : (
          <SnapRow>
            {items.map((item) => (
              <Link
                key={item.id}
                to={item.to}
                className="relative w-[248px] shrink-0 snap-start rounded-2xl border border-sd-line bg-sd-surface p-4 pl-5 text-left oak-motion-control active:scale-[0.98]"
              >
                {/* Severity rides a solid mark, never the card's border or
                    fill -- colour on a large surface reads as decoration and
                    stops meaning anything. */}
                <span
                  aria-hidden
                  className={`absolute bottom-4 left-0 top-4 w-[3px] rounded-full ${
                    item.severity === "danger" ? "bg-sd-danger-mark" : "bg-sd-attention-mark"
                  }`}
                />
                <p className="text-[15px] font-semibold leading-snug tracking-[-0.01em] text-sd-ink">
                  {item.title}
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-sd-ink-muted">{item.body}</p>
                <span className="mt-3 inline-block text-[13px] font-bold text-sd-accent-ink">
                  {item.cta} →
                </span>
              </Link>
            ))}
          </SnapRow>
        )}
      </div>
    </section>
  );
}

/** The hero. The one surface on this page wearing the landing page's 2px black
 *  border -- reserved rather than adopted as the house card style, because
 *  fourteen high-contrast rectangles at 12px gaps is a wireframe, not a
 *  hierarchy, and a 2px #0A0A0A border is invisible on a black page. */
export function TotalSales({ onShare }: { onShare: () => void }) {
  return (
    <section className="sd-hero relative min-h-[172px] overflow-hidden rounded-3xl border-2 border-sd-line-strong bg-sd-surface p-5">
      <Eyebrow>Total sales</Eyebrow>
      {/* No ₦0, and no +0.0% trend pill. There is no orders table yet, so a
          confident zero next to a trend measuring nothing is a lie that looks
          like data. min-h matches the populated state so the page does not
          reflow on the day the first sale lands. */}
      <p className="sd-editorial mt-3 text-[18px] leading-snug text-sd-ink">No sales yet.</p>
      <p className="mt-1.5 max-w-[34ch] text-[13px] leading-relaxed text-sd-ink-muted">
        Your first order will show here. Nothing is hidden — there is simply nothing to count.
      </p>
      <button
        type="button"
        onClick={onShare}
        className="mt-4 h-9 rounded-full bg-sd-accent px-4 text-[13px] font-bold text-sd-on-accent oak-motion-control active:scale-[0.97]"
      >
        Share your store link
      </button>
    </section>
  );
}

export function SalesAnalytics() {
  return (
    <section>
      {/* The period selector is hidden until there is something to select a
          period of. A disabled 7D/30D/90D control over an empty chart is three
          more things that do nothing. */}
      <Eyebrow>Sales analytics</Eyebrow>
      <div className="mt-3 grid h-[180px] place-items-center rounded-2xl border border-dashed border-sd-line px-6 text-center">
        <div>
          <TrendingUp size={20} className="mx-auto text-sd-ink-faint" />
          {/* Deliberately not an empty chart frame. Axes and a flat line at zero
              read as a chart that failed to load, which is worse than honestly
              having nothing. */}
          <p className="sd-editorial mt-2.5 text-[18px] text-sd-ink">Nothing to chart yet</p>
          <p className="mt-1 text-[13px] text-sd-ink-muted">This fills in from your first sale.</p>
        </div>
      </div>
    </section>
  );
}

function Tile({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-2xl border border-sd-line bg-sd-surface p-4">
      <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-sd-ink-muted">{label}</p>
      <p className="mt-2 text-[22px] font-bold leading-none tracking-[-0.02em] tabular-nums text-sd-ink">
        {value}
      </p>
      {hint && <p className="mt-1.5 text-[11px] leading-snug text-sd-ink-faint">{hint}</p>}
    </div>
  );
}

export function StatTiles({ productCount }: { productCount: number | null }) {
  // Products listed leads because it is the only true number on this screen,
  // and leading with it sets the honesty contract for the three below it. The
  // rest show an em-dash, which cannot be misread as zero, plus the reason --
  // a blank with an explanation is information; a bare blank is a shrug.
  const dash = <span className="text-sd-ink-faint">—</span>;
  return (
    <section>
      <Eyebrow>At a glance</Eyebrow>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Tile label="Products listed" value={productCount ?? dash} />
        <Tile label="Orders" value={dash} hint="Once your first order lands." />
        <Tile label="Net revenue" value={dash} hint="Counts from your first sale." />
        <Tile label="Customers" value={dash} hint="People who have bought from you." />
      </div>
      {/* A date plus an amount is a different shape from a single number, so it
          is a row rather than a fifth tile. It is also the most useful of the
          empty states, because it is the only one the seller can act on. */}
      <Link
        to="/store/finance"
        className="mt-3 flex items-center gap-3 rounded-2xl border border-sd-line bg-sd-surface p-4 oak-motion-control active:scale-[0.99]"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sd-soft">
          <Wallet size={17} className="text-sd-ink-muted" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold tracking-[-0.01em] text-sd-ink">
            Next eligible payout
          </span>
          <span className="mt-0.5 block text-[13px] text-sd-ink-muted">
            Nothing scheduled — payouts start after your first order.
          </span>
        </span>
        <ChevronRight size={16} className="shrink-0 text-sd-ink-faint" />
      </Link>
    </section>
  );
}
