import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Package } from "lucide-react";
import { PhoneFrame } from "./PhoneFrame";

/** Landing demo 3: in-app messaging from the seller's side, on a loop. A
 *  buyer asks about a piece from the store, the seller answers and sends it,
 *  and the order comes in, all in the chat. Sample conversation. Plays only
 *  while on screen; reduced motion shows the last frame. */

// Overlapping on purpose: the product card follows the reply before it has
// settled, the order note arrives as the buyer's message lands.
const BEATS = [560, 1820, 2940, 3430, 4340, 4760, 6020, 6580];
const LOOP_MS = 11800;
const LAST = BEATS.length;

export function MessagingDemo() {
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
  const read = beat >= 6;

  return (
    <PhoneFrame ref={ref} label="A buyer and seller chatting in Oakmonte">
      <div className="ms-head">
        <ChevronLeft size={20} />
        <span className="ms-avatar">T</span>
        <div>
          <b>Tolu A.</b>
          <small>Online</small>
        </div>
      </div>

      <div className="ms-thread">
        <div className={`ms-row ms-them dd-in${on(1)}`}>
          <div className="ms-card">
            <span className="ms-card-img">
              <Package size={18} />
            </span>
            <div>
              <b>Ankara wrap dress</b>
              <small>₦45,000</small>
            </div>
          </div>
        </div>
        <div className={`ms-row ms-them dd-in${on(1)}`}>
          <p className="ms-bubble">Hi! Do you have this in a size 12?</p>
        </div>

        {beat === 2 && (
          <div className="ms-row ms-me">
            <p className="ms-bubble ms-typing">
              <i />
              <i />
              <i />
            </p>
          </div>
        )}

        <div className={`ms-row ms-me dd-in${on(3)}`}>
          <p className="ms-bubble">Yes! Size 12 is in stock. Here it is</p>
        </div>
        <div className={`ms-row ms-me dd-in${on(4)}`}>
          <div className="ms-card ms-card-buy">
            <span className="ms-card-img">
              <Package size={18} />
            </span>
            <div>
              <b>Ankara wrap dress</b>
              <small>Size 12 · ₦45,000</small>
            </div>
            <span className="ms-buy">Buy</span>
          </div>
        </div>
        <div className={`ms-ticks dd-in${on(4)}${read ? " is-read" : ""}`}>
          {read ? "Read" : "Delivered"} ✓✓
        </div>

        <div className={`ms-row ms-them dd-in${on(7)}`}>
          <p className="ms-bubble">Perfect, buying now</p>
        </div>
        <div className={`ms-order dd-in${on(8)}`}>New order · ₦45,000 · Tolu A.</div>
      </div>

      <div className="ms-input">
        <span>Message…</span>
      </div>
    </PhoneFrame>
  );
}
