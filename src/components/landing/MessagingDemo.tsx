import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Package } from "lucide-react";
import { PhoneFrame } from "./PhoneFrame";
import { DemoNav, NAV_MESSAGES, NAV_STORE } from "./DemoNav";
import { ACTIONS } from "./demo-data";
import { DemoKeyboard } from "./DemoKeyboard";

/** Landing demo 3: in-app messaging from the seller's side, on a loop. It
 *  starts on the store home, the bottom bar slides to Messages, the seller
 *  opens a customer's chat, answers, sends the piece, and the order comes in.
 *  Buyers aren't signed in, so they show as Customer-<id>. Sample
 *  conversation. Plays only while on screen; reduced motion shows the last
 *  frame. */

const CUSTOMER = "Customer-4F7K2";

// Screens: home, then the bar moves, then the inbox, the tap, and the chat.
const T_NAV = 900;
const T_INBOX = 1500;
const T_TAP = 2300;
const T_CHAT = 2700;
// Chat beats, from the moment the chat opens. Overlapping on purpose: the
// product card follows the reply before it has settled, the order note
// arrives as the buyer's message lands.
// Beat 2 is the seller typing the reply: the keyboard slides up, then the
// message box fills a letter at a time (TYPE_MS each); beat 3 sends it.
const CHAT_BEATS = [300, 1560, 3400, 3890, 4800, 5220, 6480, 7040];
const LOOP_MS = 14700;
const REPLY = "Yes! Size 12 is in stock. Here it is";
const TYPE_MS = 40;
// Typing starts once the keyboard is up.
const KEYBOARD_MS = 320;
const LAST = CHAT_BEATS.length;

type Stage = "home" | "nav" | "inbox" | "tap" | "chat";

export function MessagingDemo() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [stage, setStage] = useState<Stage>("home");
  const [beat, setBeat] = useState(0);
  const [loop, setLoop] = useState(0);
  const [typed, setTyped] = useState(0);

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
    if (reduced) {
      setStage("chat");
      setBeat(LAST);
      return;
    }
    if (!visible) return;
    setStage("home");
    setBeat(0);
    const at = (ms: number, fn: () => void) => setTimeout(fn, ms);
    const timers = [
      at(T_NAV, () => setStage("nav")),
      at(T_INBOX, () => setStage("inbox")),
      at(T_TAP, () => setStage("tap")),
      at(T_CHAT, () => setStage("chat")),
      ...CHAT_BEATS.map((ms, i) => at(T_CHAT + ms, () => setBeat(i + 1))),
      at(LOOP_MS, () => setLoop((l) => l + 1)),
    ];
    return () => timers.forEach(clearTimeout);
  }, [visible, reduced, loop]);

  // Fill the message box while the seller types; it empties when it sends.
  useEffect(() => {
    if (beat !== 2) return setTyped(0);
    let id: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      id = setInterval(() => setTyped((n) => Math.min(n + 1, REPLY.length)), TYPE_MS);
    }, KEYBOARD_MS);
    return () => {
      clearTimeout(start);
      clearInterval(id);
    };
  }, [beat]);

  const on = (n: number) => (beat >= n ? " is-on" : "");
  const read = beat >= 6;

  return (
    <PhoneFrame ref={ref} label="A seller opening a customer's chat in Oakmonte">
      {(stage === "home" || stage === "nav") && (
        <div className="md-screen md-still" key="home">
          <div className="sp-id">
            <span className="sp-logo">A</span>
            <div>
              <b>Adaeze Atelier</b>
              <small>adaeze.oakmonte.store</small>
            </div>
          </div>
          <div className="sp-pills">
            <span>Share link</span>
            <span>Edit store</span>
          </div>
          <div className="sp-title">Sales analytics</div>
          <div className="sp-chart">
            <small>This month</small>
            <strong>₦1,284,500</strong>
            <div className="chart dd-bars is-on">
              {[30, 45, 35, 58, 49, 74, 61, 80, 72, 95].map((h, i) => (
                <i key={i} style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
          <div className="sp-tiles">
            <div>
              <small>Products listed</small>
              <b>42</b>
            </div>
            <div>
              <small>Orders</small>
              <b>184</b>
            </div>
            <div>
              <small>Net revenue</small>
              <b>₦1.3M</b>
            </div>
            <div>
              <small>Customers</small>
              <b>126</b>
            </div>
          </div>
          <div>
            <div className="sp-title">Quick actions</div>
            <div className="sp-actions">
              {ACTIONS.map((a) => (
                <span key={a}>{a}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {(stage === "inbox" || stage === "tap") && (
        <div className="md-screen" key="inbox">
          <div className="md-inbox-title">Messages</div>
          <div className={`md-row${stage === "tap" ? " is-tap" : ""}`}>
            <span className="ms-avatar">C</span>
            <div>
              <b>{CUSTOMER}</b>
              <small>Hi! Do you have this in a size 12?</small>
            </div>
            <em />
          </div>
          <div className="md-row">
            <span className="ms-avatar alt">C</span>
            <div>
              <b>Customer-9B3QX</b>
              <small>Thank you, it arrived today!</small>
            </div>
          </div>
          <div className="md-row">
            <span className="ms-avatar alt2">C</span>
            <div>
              <b>Customer-2M8RD</b>
              <small>Is the black one back in stock?</small>
            </div>
          </div>
        </div>
      )}

      {stage === "chat" && (
        <div className="md-screen" key="chat">
          <div className="ms-head">
            <ChevronLeft size={20} />
            <span className="ms-avatar">C</span>
            <div>
              <b>{CUSTOMER}</b>
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

            <div className={`ms-row ms-me dd-in${on(3)}`}>
              <p className="ms-bubble">{REPLY}</p>
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
            <div className={`ms-order dd-in${on(8)}`}>New order · ₦45,000 · {CUSTOMER}</div>
          </div>

          <div className={`ms-input${beat === 2 ? " is-typing" : ""}`}>
            {beat === 2 ? (
              <span className="ms-typed">
                {REPLY.slice(0, typed)}
                <i className="ms-caret" />
              </span>
            ) : (
              <span>Message…</span>
            )}
          </div>
          <DemoKeyboard
            open={beat === 2}
            pressed={beat === 2 && typed > 0 && typed < REPLY.length ? REPLY[typed - 1] : null}
          />
        </div>
      )}

      {stage !== "chat" && <DemoNav active={stage === "home" ? NAV_STORE : NAV_MESSAGES} />}
    </PhoneFrame>
  );
}
