import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, ChevronRight, Megaphone, TrendingUp, Wallet } from "lucide-react";

/** The landing page's blue-dot micro-label. Used ONCE on the page, inside the
 *  sales hero. It used to head every section, which made seven sections read as
 *  seven equal things and gave the page no top -- the landing uses it above a
 *  big headline, never as the headline. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="oak-eyebrow">{children}</p>;
}

/** A real heading, so the page has an outline a screen reader can jump
 *  through, and a size step above body copy that a sighted reader can scan. */
export function SectionTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="text-[17px] font-semibold tracking-[-0.02em] text-sd-ink">
      {children}
    </h2>
  );
}

/** A horizontally scrolling row of cards, for when a section has more than one.
 *
 *  Native scroll snap rather than a hand-rolled gesture: the browser's physics
 *  beat anything written here, and it stays interruptible for free. No
 *  `touch-action` on it -- `pan-y` there tells the browser the element may only
 *  pan vertically, which is right for a JS-driven carousel and silently kills
 *  the sideways swipe of a native one. `py-1` keeps focus rings from being
 *  clipped by the scroll container. */
export function SnapRow({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain scroll-px-4 px-4 py-1">
      {children}
    </div>
  );
}

/** The quiet surface every empty section uses: one icon, one sentence.
 *
 *  Solid, not dashed. Everywhere else in this app a dashed box means "tap to add
 *  something" -- the payout sheet, pickup locations, the image gallery -- and
 *  sellers learned that during setup. A dashed box that does nothing when
 *  tapped teaches them the wrong thing. */
function QuietNote({ icon: Icon, children }: { icon: typeof Bell; children: ReactNode }) {
  return (
    <div className="mt-3 flex items-start gap-3 rounded-2xl border border-sd-line bg-sd-elevated p-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sd-surface">
        <Icon size={17} className="text-sd-ink-muted" />
      </span>
      <p className="pt-1.5 text-[14px] leading-relaxed text-sd-ink-muted">{children}</p>
    </div>
  );
}

export function WhatsNew() {
  return (
    <section aria-labelledby="sd-whats-new">
      <SectionTitle id="sd-whats-new">What&apos;s new</SectionTitle>
      <QuietNote icon={Megaphone}>
        New features, payout changes and tips for sellers will show up here.
      </QuietNote>
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
    <section aria-labelledby="sd-attention">
      <SectionTitle id="sd-attention">Needs attention</SectionTitle>
      {items.length === 0 ? (
        // Says what the section is FOR rather than claiming the store is fine.
        // It used to read "All clear", but nothing feeds this section yet, so
        // that was an assurance the page had not earned -- the same kind of
        // unearned claim as printing a zero for sales it cannot count.
        <QuietNote icon={Bell}>
          Anything that needs you — an order to ship, low stock, a payout problem — will show up
          here first.
        </QuietNote>
      ) : (
        <div className="mt-3">
          <SnapRow>
            {items.map((item) => (
              <Link
                key={item.id}
                to={item.to}
                className="oak-tap relative w-[248px] shrink-0 snap-start rounded-2xl border border-sd-line bg-sd-surface p-4 pl-5 text-left oak-motion-control active:scale-[0.98]"
              >
                {/* Severity rides a solid mark, never the card's border or
                    fill: colour across a large surface reads as decoration and
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
        </div>
      )}
    </section>
  );
}

/** The hero, and for a seller with no orders yet, the whole point of the page.
 *
 *  The one surface wearing the landing page's 2px black border -- reserved
 *  rather than adopted as the house card style, because fourteen high-contrast
 *  rectangles at a 12px gap is a wireframe rather than a hierarchy, and a 2px
 *  #0A0A0A border vanishes on a black page.
 *
 *  With no sales it is the first-run screen: one job, one full-width button. It
 *  used to frame the words "No sales yet" with the heaviest border on the page
 *  and hand over a 36px button, so the thing a new seller most needed to do was
 *  the least prominent control on screen. Still no NGN 0 and no trend pill --
 *  there is no orders table, and a zero beside a trend measuring nothing is a
 *  lie that looks like data. */
export function TotalSales({ onShare }: { onShare: () => void }) {
  return (
    <section
      aria-labelledby="sd-sales"
      className="sd-hero relative overflow-hidden rounded-3xl border-2 border-sd-line-strong bg-sd-hero-bg p-5"
    >
      <Eyebrow>Total sales</Eyebrow>
      <h2
        id="sd-sales"
        className="sd-editorial mt-3 text-[28px] leading-[1.1] tracking-[-0.02em] text-sd-ink"
      >
        Now get your first order.
      </h2>
      <p className="mt-2 text-[14px] leading-relaxed text-sd-ink-muted">
        Send your store link to your WhatsApp contacts and post it on your status.
      </p>
      <button
        type="button"
        onClick={onShare}
        className="mt-5 h-12 w-full rounded-full bg-sd-accent text-[15px] font-semibold text-sd-on-accent oak-motion-control active:scale-[0.98]"
      >
        Share your store link
      </button>
      <p className="mt-3 text-center text-[13px] text-sd-ink-muted">
        Your sales total appears here after your first order.
      </p>
    </section>
  );
}

export function SalesAnalytics() {
  return (
    <section aria-labelledby="sd-analytics">
      {/* The period selector (7D / 30D / 90D) is hidden until there is
          something to select a period of: a control over an empty chart is
          three more things that do nothing. And no empty chart frame -- axes
          and a flat line at zero read as a chart that failed to load. */}
      <SectionTitle id="sd-analytics">Sales analytics</SectionTitle>
      <QuietNote icon={TrendingUp}>Your sales chart starts with your first order.</QuietNote>
    </section>
  );
}

function Tile({ label, value, to }: { label: string; value: ReactNode; to?: "/store/products" }) {
  const body = (
    <>
      <p className="text-[13px] font-medium text-sd-ink-muted">{label}</p>
      <p className="mt-2 text-[22px] font-bold leading-none tracking-[-0.02em] tabular-nums text-sd-ink">
        {value}
      </p>
    </>
  );
  const cls = "block rounded-2xl border border-sd-line bg-sd-surface p-4";
  return to ? (
    // The only real number on the screen should go somewhere when tapped.
    <Link to={to} className={`oak-tap ${cls} oak-motion-control active:scale-[0.98]`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function StatTiles({
  productCount,
  payoutVerified,
}: {
  productCount: number | null;
  payoutVerified: boolean;
}) {
  // Products listed leads because it is the only true number here, which sets
  // the honesty contract for the three beside it. They show an em-dash, which
  // cannot be misread as zero. One shared line explains all three rather than
  // repeating "your first sale" under each tile.
  const dash = <span className="text-sd-ink-muted">—</span>;
  return (
    <section aria-labelledby="sd-glance">
      <SectionTitle id="sd-glance">At a glance</SectionTitle>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Tile label="Products listed" value={productCount ?? dash} to="/store/products" />
        <Tile label="Orders" value={dash} />
        <Tile label="Net revenue" value={dash} />
        <Tile label="Customers" value={dash} />
      </div>
      <p className="mt-2 text-[12px] leading-snug text-sd-ink-muted">
        Orders, revenue and customers fill in as you start selling.
      </p>
      {/* A date plus an amount is a different shape from a single number, so
          this is a row rather than a fifth tile. It also carries the payout
          account's state onto the dashboard: the checklist showed it as
          pending, and that must not simply vanish once the seller graduates. */}
      <Link
        to="/store/finance"
        className="oak-tap mt-3 flex items-center gap-3 rounded-2xl border border-sd-line bg-sd-surface p-4 oak-motion-control active:scale-[0.99]"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sd-soft">
          <Wallet size={17} className="text-sd-ink-muted" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold tracking-[-0.01em] text-sd-ink">
            Next eligible payout
          </span>
          <span className="mt-0.5 block text-[13px] text-sd-ink-muted">
            {payoutVerified
              ? "Payouts start after your first order."
              : "Bank account saved. We’ll confirm it before your first payout."}
          </span>
        </span>
        <ChevronRight size={16} className="shrink-0 text-sd-ink-muted" />
      </Link>
    </section>
  );
}
