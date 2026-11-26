import { useEffect, useMemo, useRef, useState } from "react";
import { FullPreview } from "./full-previews";
import type { ThemeId } from "./types";
import type { DesktopHero } from "./edit-types";
import { viewOnly } from "./view-only";
import { GLASS_RIM, glassLens, glassLight } from "@/lib/liquid-glass";
import { Share2, ShoppingBag } from "lucide-react";
import shopIcon from "@/assets/Store.svg";
import streetwearPhoto from "@/assets/streetwear-summerstyle.jpeg";
import storyPhoto from "@/assets/fashion-story.jpg";
import editorialPhoto from "@/assets/hero-editorial.jpg";
import povPhoto from "@/assets/female-first-person-pov.jpg";
import homeIcon from "@/assets/Home.svg";
import messagesIcon from "@/assets/messages.svg";

// A sample storefront in a phone frame, with the store / feed / messages bar
// every Oakmonte website carries. Shared by /showcase (three of them, each
// moving its own way) and the Website tab before a store exists.

/** How each phone moves, so the three don't all do the same thing:
 *  chat   -- taps Messages: a buyer asks, the store answers, an offer is agreed;
 *  cards  -- the floating-cards hero, its 3D ring turning, the phone at rest;
 *  float  -- the hero slideshow, the phone drifting with a slight 3D tilt,
 *            now and then tapping Home to show the store's video feed. */
export type Motion = "chat" | "cards" | "float";

/** Each phone is laid out at a real phone width, then drawn smaller. */
export const PHONE_W = 390;
export const PHONE_H = 780;

/** The feed demo's posts: a caption and the piece each one links. */
const FEED_POSTS = [
  {
    image: streetwearPhoto,
    caption: "New drop is live. Tap the bag to shop the look.",
    piece: "Summer Set",
  },
  {
    image: storyPhoto,
    caption: "Behind the scenes from this week's shoot.",
    piece: "Wide Trousers",
  },
  {
    image: editorialPhoto,
    caption: "Styled three ways. Which one is yours?",
    piece: "Cropped Jacket",
  },
  { image: povPhoto, caption: "Back in stock in every size.", piece: "Day Tote" },
];

/** The chat demo's typing pace (ms a letter), as the landing's demo, and its
 *  keyboard. */
const TYPE_MS = 45;
const KEYBOARD_H = 290;
const KEY_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

/** The chat demo: a buyer asks, the store answers, an offer is agreed. */
const CHAT: { from: "buyer" | "store"; text?: string; offer?: string; list?: string }[] = [
  { from: "buyer", text: "Hi! Is the cropped jacket still available in M?" },
  { from: "store", text: "Yes, M and L are both in stock 🙌" },
  { from: "buyer", offer: "₦38,000", list: "₦45,000" },
  { from: "store", text: "Deal! Tap Buy whenever you're ready." },
];

/** One storefront in a phone frame, with the storefront's store / feed /
 *  messages pill at the bottom, moving its own way (see Motion). */
export function PhonePreview({
  themeId,
  brandName,
  scale,
  motion,
  hero,
  drift,
}: {
  themeId: ThemeId;
  brandName: string;
  scale: number;
  motion: Motion;
  hero: DesktopHero;
  /** The float phone drifts and tilts (oak-phone-float). */
  drift: boolean;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const editing = useMemo(() => viewOnly(hero), [hero]);
  // The nav's active tab (0 store, 1 feed, 2 messages), a tap ring on the nav,
  // the feed post on screen ("float") and how far the chat has got ("chat").
  const [tab, setTab] = useState(0);
  const [post, setPost] = useState(0);
  const [navTap, setNavTap] = useState<number | null>(null);
  const [chatStep, setChatStep] = useState(0);
  // The buyer's message box while they type (letters so far), and the store's
  // "typing…" dots before each of its replies -- as in the landing's demo.
  const [draft, setDraft] = useState<string | null>(null);
  const [storeTyping, setStoreTyping] = useState(false);

  // "chat": 4s on the store, tap Messages, then the conversation plays out --
  // the buyer typing each line on the keyboard and sending it, the store's
  // replies after its typing dots -- then tap Store, and again.
  useEffect(() => {
    if (motion !== "chat") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const wait = (ms: number) => new Promise<void>((done) => timers.push(setTimeout(done, ms)));

    const run = async () => {
      while (!cancelled) {
        await wait(4000);
        setNavTap(2);
        await wait(500);
        setTab(2);
        setChatStep(0);
        await wait(500);
        setNavTap(null);
        await wait(500);
        for (let i = 0; i < CHAT.length && !cancelled; i++) {
          const m = CHAT[i];
          if (m.from === "buyer" && m.text) {
            setDraft("");
            await wait(320); // the keyboard comes up
            for (let n = 1; n <= m.text.length && !cancelled; n++) {
              setDraft(m.text.slice(0, n));
              await wait(TYPE_MS);
            }
            await wait(300);
            setDraft(null);
          } else if (m.from === "store") {
            setStoreTyping(true);
            await wait(1300);
            setStoreTyping(false);
          }
          setChatStep(i + 1);
          await wait(900);
        }
        await wait(2000);
        setNavTap(0);
        await wait(500);
        setTab(0);
        await wait(500);
        setNavTap(null);
      }
    };
    void run();
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [motion]);

  // "cards": the floating-cards hero first, then the page scrolls down into
  // the store's collections and products, the way a buyer would, and back up.
  // It used to stop at the hero, so the middle phone never showed a single
  // product -- the one thing a storefront is for.
  useEffect(() => {
    if (motion !== "cards") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = scrollerRef.current;
    if (!el) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    const to = (top: number) => el.scrollTo({ top, behavior: "smooth" });
    const cycle = () => {
      at(3500, () => to(PHONE_H * 0.85));
      at(6500, () => to(PHONE_H * 1.7));
      at(9500, () => to(PHONE_H * 2.5));
      at(12500, () => to(0));
      at(14500, cycle);
    };
    cycle();
    return () => timers.forEach(clearTimeout);
  }, [motion]);

  useEffect(() => {
    if (motion !== "float") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    const SWIPES = 3;
    const cycle = () => {
      // 4s on the store, tap Home, swipe through posts, tap Store, repeat.
      at(4000, () => setNavTap(1));
      at(4500, () => {
        setTab(1);
        setPost(0);
      });
      at(5000, () => setNavTap(null));
      for (let n = 1; n <= SWIPES; n++) at(4500 + n * 2400, () => setPost(n));
      const back = 4500 + (SWIPES + 1) * 2400;
      at(back, () => setNavTap(0));
      at(back + 500, () => setTab(0));
      at(back + 1000, () => {
        setNavTap(null);
        cycle();
      });
    };
    cycle();
    return () => timers.forEach(clearTimeout);
  }, [motion]);

  return (
    // The box takes the phone's drawn size; the phone inside is laid out at
    // real phone size and scaled down into it. This used to be CSS `zoom`,
    // which Safari applies differently from Chrome -- the rem-based corner
    // radius and the frame's proportions came out wrong on iPads (corners far
    // too round, the phone stretched long) while every test in Chrome looked
    // right. A transform scales everything identically in every browser.
    // The drift lives on this outer box so its keyframed transform doesn't
    // replace the scale.
    <div
      className={motion === "float" && drift ? "oak-phone-float" : ""}
      style={{ width: PHONE_W * scale, height: PHONE_H * scale }}
    >
      <div
        className="relative overflow-hidden rounded-[40px] border-[3px] border-neutral-900 bg-neutral-900 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)]"
        style={{
          width: PHONE_W,
          height: PHONE_H,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {/* A picture of a store, not a store: no taps get in. */}
        <div
          ref={scrollerRef}
          className="no-scrollbar pointer-events-none h-full overflow-hidden"
          aria-hidden="true"
        >
          <div className="@container overflow-x-clip">
            <FullPreview themeId={themeId} storeId={null} brandName={brandName} editing={editing} />
          </div>
        </div>

        {/* The store's Messages (the third tab): a buyer's chat with the store,
          a bubble at a time, ending in an agreed offer. */}
        {motion === "chat" && (
          <div
            className="pointer-events-none absolute inset-0 z-30 flex flex-col bg-black text-white transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
            style={{ transform: tab === 2 ? "translateX(0)" : "translateX(100%)" }}
            aria-hidden="true"
          >
            <div className="flex items-center gap-3 border-b border-white/15 px-5 pb-3 pt-6">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-white/15 text-[17px] font-bold">
                {brandName.charAt(0).toUpperCase()}
              </span>
              <div>
                <p className="text-[17px] font-semibold">{brandName}</p>
                <p className="text-[13px] text-white/60">Usually replies within an hour</p>
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-3 px-4 pt-5">
              {CHAT.slice(0, chatStep).map((m, i) =>
                m.offer ? (
                  <div
                    key={i}
                    className="animate-in fade-in slide-in-from-bottom-2 self-end w-[75%] rounded-2xl border border-white/25 bg-white/10 p-3 duration-300"
                  >
                    <p className="text-[12px] uppercase tracking-[0.12em] text-white/60">Offer</p>
                    <p className="mt-1 text-[20px] font-semibold">
                      {m.offer}{" "}
                      <span className="text-[14px] text-white/50 line-through">{m.list}</span>
                    </p>
                    <p className="mt-1 text-[13px] font-semibold text-emerald-400">Accepted</p>
                  </div>
                ) : (
                  <p
                    key={i}
                    className={`animate-in fade-in slide-in-from-bottom-2 max-w-[78%] rounded-3xl px-4 py-2.5 text-[15px] leading-snug duration-300 ${
                      m.from === "buyer"
                        ? "self-end rounded-br-md bg-[#0EA5E9]"
                        : "self-start rounded-bl-md bg-white/15"
                    }`}
                  >
                    {m.text}
                  </p>
                ),
              )}
              {storeTyping && (
                <span className="flex self-start gap-1.5 rounded-3xl rounded-bl-md bg-white/15 px-4 py-3.5">
                  {[0, 1, 2].map((d) => (
                    <i
                      key={d}
                      className="oak-typing-dot h-2 w-2 rounded-full bg-white/80"
                      style={{ animationDelay: `${d * 0.16}s` }}
                    />
                  ))}
                </span>
              )}
            </div>

            {/* The message box, filling a letter at a time while the buyer types. */}
            <div
              className="absolute inset-x-4 z-10 transition-[bottom] duration-300 ease-out"
              style={{ bottom: draft !== null ? KEYBOARD_H + 12 : 100 }}
            >
              <div
                className={`flex min-h-12 items-center rounded-3xl px-4 py-3 text-[15px] ${
                  draft !== null
                    ? "bg-white text-[#111] ring-2 ring-[#0EA5E9]"
                    : "bg-white/10 text-white/50"
                }`}
              >
                {draft !== null ? (
                  <span>
                    {draft}
                    <i className="oak-caret ml-px inline-block h-[17px] w-[1.5px] translate-y-[3px] bg-[#0EA5E9]" />
                  </span>
                ) : (
                  "Message…"
                )}
              </div>
            </div>

            {/* The keyboard: slides up while typing, the last key pressed pops. */}
            <div
              className="absolute inset-x-0 bottom-0 z-20 bg-[#d1d4da] px-1.5 pb-6 pt-2 transition-transform duration-300 ease-out"
              style={{
                height: KEYBOARD_H,
                transform: draft !== null ? "translateY(0)" : "translateY(100%)",
              }}
            >
              {KEY_ROWS.map((row, r) => (
                <div key={r} className="mb-2.5 flex justify-center gap-1.5">
                  {[...row].map((k) => {
                    const hit = draft ? draft[draft.length - 1]?.toLowerCase() === k : false;
                    return (
                      <span
                        key={k}
                        className={`grid h-11 w-[32px] place-items-center rounded-md text-[18px] text-[#111] shadow-[0_1px_0_rgba(0,0,0,0.3)] transition-transform duration-75 ${
                          hit ? "-translate-y-2 scale-125 bg-white" : "bg-white"
                        }`}
                      >
                        {k}
                      </span>
                    );
                  })}
                </div>
              ))}
              <div className="flex justify-center gap-1.5">
                <span className="grid h-11 w-20 place-items-center rounded-md bg-[#abb0ba] text-[15px] text-[#111]">
                  123
                </span>
                <span
                  className={`grid h-11 flex-1 place-items-center rounded-md text-[15px] text-[#111] ${
                    draft?.endsWith(" ") ? "bg-[#e5e7eb]" : "bg-white"
                  }`}
                >
                  space
                </span>
                <span className="grid h-11 w-20 place-items-center rounded-md bg-[#abb0ba] text-[15px] text-[#111]">
                  send
                </span>
              </div>
            </div>
          </div>
        )}

        {/* The store's video feed (the Home tab): full-screen posts, swiped up one
          after another, with the linked-product rail and the feed's own tabs. */}
        {motion === "float" && (
          <div
            className="pointer-events-none absolute inset-0 z-30 overflow-hidden bg-black transition-opacity duration-300"
            style={{ opacity: tab === 1 ? 1 : 0 }}
            aria-hidden="true"
          >
            <div
              className="h-full transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
              style={{ transform: `translateY(-${post * PHONE_H}px)` }}
            >
              {FEED_POSTS.map((p, i) => (
                <div key={i} className="relative" style={{ height: PHONE_H }}>
                  <img src={p.image} alt="" className="h-full w-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />
                  {/* Rail: store picture, add to bag, share. */}
                  <div className="absolute bottom-[150px] right-3 flex flex-col items-center gap-6 text-white">
                    <span className="grid h-12 w-12 place-items-center rounded-full border-2 border-white bg-white/20 text-[18px] font-bold">
                      {brandName.charAt(0).toUpperCase()}
                    </span>
                    <ShoppingBag size={30} strokeWidth={2} />
                    <Share2 size={28} strokeWidth={2} />
                  </div>
                  {/* Caption and the linked piece. */}
                  <div className="absolute bottom-[150px] left-4 right-20 text-white">
                    <p className="text-[16px] font-semibold">{brandName}</p>
                    <p className="mt-1 text-[14px] leading-snug text-white/85">{p.caption}</p>
                    <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1.5 text-[13px] font-semibold backdrop-blur">
                      <ShoppingBag size={14} /> {p.piece}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="absolute inset-x-0 top-0 flex justify-center gap-10 bg-gradient-to-b from-black/45 to-transparent pb-6 pt-5 text-[15px] font-medium text-white/70">
              <span className="font-semibold text-white underline underline-offset-4">For you</span>
              <span>Listed items</span>
            </div>
          </div>
        )}

        {/* The storefront's own nav: store, feed, messages. */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-6 z-40 flex justify-center transition-[opacity,transform] duration-300"
          // Out of the way while the keyboard is up, as in a real chat.
          style={{
            opacity: draft !== null ? 0 : 1,
            transform: draft !== null ? "translateY(40px)" : "none",
          }}
        >
          <div
            className={`${GLASS_RIM} relative flex h-[60px] items-center rounded-full p-[5px]`}
            style={glassLight}
          >
            {[shopIcon, homeIcon, messagesIcon].map((icon, i) => (
              <span key={icon} className="relative grid h-full w-[62px] place-items-center">
                {i === tab && (
                  <span
                    className={`${GLASS_RIM} absolute inset-0 rounded-full`}
                    style={glassLens}
                  />
                )}
                {navTap === i && (
                  <span className="oak-showcase-tap absolute h-14 w-14 rounded-full border-4 border-black/70 bg-black/10" />
                )}
                <img
                  src={icon}
                  alt=""
                  className="relative"
                  style={{
                    width: 25,
                    height: 25,
                    filter: "brightness(0)",
                    opacity: i === tab ? 1 : 0.55,
                  }}
                />
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
