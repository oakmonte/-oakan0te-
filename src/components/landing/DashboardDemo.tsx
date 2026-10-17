import { useEffect, useRef, useState } from "react";

/** Landing demo 1: the seller dashboard building itself, on a loop. Drawn in
 *  code from the real dashboard's sections, labels and order
 *  (src/components/store/dashboard) -- a few KB instead of a video, sharp at
 *  any size, and a one-line edit when the dashboard changes. Sample store and
 *  figures. Plays only while on screen; reduced motion shows the last frame.
 *  Styled by the sp-* / dd-* rules in routes/index.tsx's stylesheet. */

// When each beat starts (ms from the top of the loop).
const BEATS = [300, 900, 1500, 2600, 3800, 5000, 6400];
const LOOP_MS = 9500;
const LAST = BEATS.length;

function useCountUp(target: number, run: boolean, instant: boolean, ms = 1100) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!run) return setV(0);
    if (instant) return setV(target);
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, instant, ms]);
  return v;
}

const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;

const ACTIONS = [
  "Add product",
  "Import products",
  "Pickup locations",
  "Collections",
  "Orders",
  "Discounts",
];

export function DashboardDemo() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [beat, setBeat] = useState(0);
  const [loop, setLoop] = useState(0);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), {
      threshold: 0.35,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (reduced) return setBeat(LAST);
    if (!visible) return;
    setBeat(0);
    const timers = BEATS.map((at, i) => setTimeout(() => setBeat(i + 1), at));
    timers.push(setTimeout(() => setLoop((l) => l + 1), LOOP_MS));
    return () => timers.forEach(clearTimeout);
  }, [visible, reduced, loop]);

  const on = (n: number) => (beat >= n ? " is-on" : "");
  const revenue = useCountUp(1284500, beat >= 4, reduced);
  const products = useCountUp(42, beat >= 5, reduced, 800);
  const orders = useCountUp(184, beat >= 5, reduced, 900);
  const customers = useCountUp(126, beat >= 5, reduced, 900);

  return (
    <div ref={ref} className="studio-phone dd" aria-label="The Oakmonte seller dashboard">
      <div className="sp-screen" aria-hidden="true">
        <div className={`sp-id dd-in${on(1)}`}>
          <span className="sp-logo">A</span>
          <div>
            <b>Adaeze Atelier</b>
            <small>adaeze.oakmonte.store</small>
          </div>
        </div>
        <div className={`sp-pills dd-in${on(2)}`}>
          <span>Share link</span>
          <span>Edit store</span>
        </div>
        <div className={`dd-in${on(3)}`}>
          <div className="sp-title">Sales analytics</div>
          <div className="sp-chart">
            <small>This month</small>
            <strong>{naira(revenue)}</strong>
            <div className={`chart dd-bars${on(3)}`}>
              {[30, 45, 35, 58, 49, 74, 61, 80, 72, 95].map((h, i) => (
                <i key={i} style={{ height: `${h}%`, transitionDelay: `${i * 70}ms` }} />
              ))}
            </div>
          </div>
        </div>
        <div className={`sp-tiles dd-in${on(5)}`}>
          <div>
            <small>Products listed</small>
            <b>{products}</b>
          </div>
          <div>
            <small>Orders</small>
            <b>{orders}</b>
          </div>
          <div>
            <small>Net revenue</small>
            <b>₦{(revenue / 1_000_000).toFixed(1)}M</b>
          </div>
          <div>
            <small>Customers</small>
            <b>{customers}</b>
          </div>
        </div>
        <div className={`dd-in${on(6)}`}>
          <div className="sp-title">Quick actions</div>
          <div className="sp-actions">
            {ACTIONS.map((a) => (
              <span key={a} className={a === "Orders" && beat >= 7 ? "dd-tap" : undefined}>
                {a}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
