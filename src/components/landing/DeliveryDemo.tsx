import { useEffect, useRef, useState } from "react";
import { PhoneFrame } from "./PhoneFrame";
import { Check, MapPin, Package, Truck } from "lucide-react";

/** Landing demo 2: an order, from landing to paid out, on a loop. Follows the
 *  real flow: the buyer pays delivery at checkout, the seller taps Book
 *  courier (api.store.orders.$orderId.ship, paid from Oakmonte's Shipbubble
 *  wallet), the rider is tracked, and the seller's share is released on
 *  delivery (payouts.server.ts: 95.5% of the items total). Sample order.
 *  Plays only while on screen; reduced motion shows the last frame. */

const BEATS = [300, 1500, 2300, 3300, 4600, 6200, 7800, 9000];
const LOOP_MS = 12500;
const LAST = BEATS.length;

const STEPS = [
  { at: 5, label: "Picked up", sub: "From your pickup location" },
  { at: 6, label: "On the way", sub: "Rider is 12 mins away" },
  { at: 7, label: "Delivered", sub: "Signed for by Tolu" },
];

export function DeliveryDemo() {
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
  const booked = beat >= 3;

  return (
    <PhoneFrame ref={ref} label="An order being delivered automatically">
      <div className="sp-title">Orders</div>

      <div className={`dl-order dd-in${on(1)}`}>
        <span className="dl-thumb">
          <Package size={18} />
        </span>
        <div className="dl-order-text">
          <small>New order · paid</small>
          <b>Ankara wrap dress · Size 12</b>
          <span>Tolu A. · Lekki Phase 1</span>
        </div>
        <strong>₦45,000</strong>
      </div>

      <div className={`dd-in${on(1)}`}>
        <span className={`dl-book${beat === 2 ? " dd-tap" : ""}${booked ? " is-done" : ""}`}>
          {booked ? (
            <>
              <Check size={14} strokeWidth={3} /> Courier booked · pickup 2–4pm
            </>
          ) : (
            <>
              <Truck size={14} /> Book courier
            </>
          )}
        </span>
      </div>

      <div className={`dl-map dd-in${on(4)}`}>
        <svg viewBox="0 0 280 120" preserveAspectRatio="none">
          <path
            id="dl-route"
            className={`dl-route${on(4)}`}
            d="M24 92 C 80 92, 90 30, 150 44 S 230 70, 256 24"
          />
          {beat >= 5 && !reduced && <Rider />}
          {reduced && <circle r="7" cx="256" cy="24" className="dl-rider" />}
        </svg>
        <span className="dl-pin dl-pin-a">
          <MapPin size={14} />
        </span>
        <span className="dl-pin dl-pin-b">
          <MapPin size={14} />
        </span>
      </div>

      <div className="dl-steps">
        {STEPS.map((s) => (
          <div key={s.label} className={`dl-step dd-in${on(s.at)}`}>
            <span className={`dl-dot${s.at === 7 && beat >= 7 ? " is-done" : ""}`}>
              <Check size={10} strokeWidth={3.5} />
            </span>
            <div>
              <b>{s.label}</b>
              <small>{s.sub}</small>
            </div>
          </div>
        ))}
      </div>

      <div className={`dl-paid dd-in${on(8)}`}>
        <span className="dl-paid-icon">
          <Check size={16} strokeWidth={3} />
        </span>
        <div>
          <b>₦42,975 sent to your bank</b>
          <small>Released the moment it was delivered</small>
        </div>
      </div>
    </PhoneFrame>
  );
}

/** The rider, driving the route. SMIL times from when the SVG first appeared,
 *  so a dot added later with begin="0s" would already be at the end: it waits
 *  (begin="indefinite") and is started when it mounts. */
function Rider() {
  const anim = useRef<SVGAnimateMotionElement | null>(null);
  useEffect(() => {
    anim.current?.beginElement();
  }, []);
  return (
    <circle r="7" className="dl-rider">
      <animateMotion ref={anim} begin="indefinite" dur="3.2s" fill="freeze">
        <mpath href="#dl-route" />
      </animateMotion>
    </circle>
  );
}
