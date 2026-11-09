import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useActiveStore } from "@/hooks/use-own-store";
import { FullPreview } from "@/components/store-themes/full-previews";
import { THEMES, type ThemeId } from "@/components/store-themes/types";
import {
  createInitialEditState,
  type DesktopHero,
  type ThemeEditingProps,
} from "@/components/store-themes/edit-types";
import { HERO_SLIDESHOW_IMAGES } from "@/components/store-themes/hero-placeholders";
import { GLASS_RIM, glassLens, glassLight } from "@/lib/liquid-glass";
import { clearShowcase } from "@/lib/showcase-handoff";
import { Share2, ShoppingBag } from "lucide-react";
import shopIcon from "@/assets/Store.svg";
import streetwearPhoto from "@/assets/streetwear-summerstyle.jpeg";
import storyPhoto from "@/assets/fashion-story.jpg";
import editorialPhoto from "@/assets/hero-editorial.jpg";
import povPhoto from "@/assets/female-first-person-pov.jpg";
import homeIcon from "@/assets/Home.svg";
import messagesIcon from "@/assets/messages.svg";

// Right after onboarding's Finish (via /welcome): three real storefronts in
// three very different themes, each wearing the seller's own store name and
// each moving its own way, before the setup checklist -- so the checklist
// reads as the way to get *this*, not a chore.
export const Route = createFileRoute("/showcase")({
  head: () => ({
    meta: [{ title: "Your store — Oakmonte" }, { name: "theme-color", content: "#ffffff" }],
  }),
  component: ShowcasePage,
});

/** How each phone moves, so the three don't all do the same thing:
 *  chat   -- taps Messages: a buyer asks, the store answers, an offer is agreed;
 *  cards  -- the floating-cards hero, its 3D ring turning, the phone at rest;
 *  float  -- the hero slideshow, the phone drifting with a slight 3D tilt,
 *            now and then tapping Home to show the store's video feed. */
type Motion = "chat" | "cards" | "float";

/** Three looks as unlike each other as the catalogue has: cool light blue,
 *  dark streetwear, warm editorial. The middle one is in front. */
const SHOWN: { id: ThemeId; motion: Motion; hero: DesktopHero }[] = [
  { id: "ice", motion: "chat", hero: "banner" },
  { id: "motion", motion: "cards", hero: "cards" },
  { id: "banner", motion: "float", hero: "banner" },
];

/** Each phone is laid out at a real phone width, then drawn smaller. */
const PHONE_W = 390;
const PHONE_H = 780;
const GAP = 28;
/** Below this width the three fan out, overlapping, instead of a row. */
const FAN_BELOW = 760;
/** How far each side phone sits from the middle, in phone-widths, and how many
 *  phone-widths the whole fan takes (sides, tilt and all). */
const FAN_OFFSET = 0.86;
const FAN_SPAN = 2.98;
/** Height the heading, captions and Finish button take, around the phones. */
const CHROME_H = 330;
const MIN_HEIGHT_SCALE = 0.3;

const noop = () => {};

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

/** View-only storefront settings, like the live storefront builds: the
 *  theme's placeholder photos, and which hero to show. */
function viewOnly(hero: DesktopHero): ThemeEditingProps {
  const s = createInitialEditState();
  return {
    isEditing: false,
    logoMode: s.logoMode,
    onLogoModeChange: noop,
    logoImage: s.logoImage,
    onLogoChange: noop,
    slideshowImages: HERO_SLIDESHOW_IMAGES,
    onAddSlideshowImages: noop,
    onRemoveSlideshowImage: noop,
    onClearSlideshow: noop,
    slideshowCrops: s.slideshowCrops,
    onSlideshowCropChange: noop,
    slideshowAspectRatio: s.slideshowAspectRatio,
    onSlideshowAspectRatioChange: noop,
    tileCrops: s.tileCrops,
    onTileCropChange: noop,
    text: s.text,
    onTextChange: noop,
    textFonts: s.textFonts,
    onTextFontChange: noop,
    hiddenBlocks: s.hiddenBlocks,
    onRemoveBlock: noop,
    onRestoreBlock: noop,
    layoutId: s.layoutId,
    onLayoutChange: noop,
    columns: s.columns,
    onColumnsChange: noop,
    onTileTapBlocked: noop,
    stickyBottom: s.stickyBottom,
    desktopHero: hero,
  };
}

function ShowcasePage() {
  const { store } = useActiveStore();
  const navigate = useNavigate();
  const router = useRouter();
  const brandName = store?.brand_name?.trim() || "Your store";
  const [vw, setVw] = useState(0);
  const [vh, setVh] = useState(0);

  // Shown now: a later pass through /welcome (an app launch) goes to the
  // dashboard. And the dashboard is where this leads, so have it ready.
  useEffect(() => {
    clearShowcase();
    void router.preloadRoute({ to: "/store" }).catch(() => {});
    const measure = () => {
      setVw(window.innerWidth);
      setVh(window.innerHeight);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [router]);

  const looks = SHOWN.flatMap((look) => {
    const theme = THEMES.find((t) => t.id === look.id);
    return theme ? [{ ...look, theme }] : [];
  });
  const fan = vw > 0 && vw < FAN_BELOW;
  // A row: all three fit across the screen. A fan: one phone's size, with the
  // other two tucked behind it.
  // The fan spans about FAN_SPAN phone-widths (the side phones, their tilt and
  // the gaps), kept inside the screen with a margin either side.
  //
  // Height counts too. The caps used to be fixed (0.4 fanned, 0.5 in a row),
  // tuned for phones and laptops — an iPad mini (744 wide, under FAN_BELOW)
  // got three 156px phones floating in an 1133px-tall screen. Now each phone
  // grows to whatever the width AND the height leave room for, with the
  // heading and the Finish button (CHROME_H) taken off the height first.
  const heightFit = vh > 0 ? (vh - CHROME_H) / (PHONE_H + 70) : 1;
  // Height can shrink a phone only down to MIN_HEIGHT_SCALE: a phone held
  // sideways (375 tall) would otherwise get 78px phones nobody can read.
  // Below that the page scrolls a little instead. Width always wins, so a
  // narrow screen never overflows sideways.
  const byWidth = fan
    ? Math.min(0.65, (vw - 40) / (PHONE_W * FAN_SPAN))
    : Math.min(0.5, (vw - 96 - GAP * 2) / (PHONE_W * 3));
  const scale = Math.min(byWidth, Math.max(MIN_HEIGHT_SCALE, heightFit));
  const phoneW = PHONE_W * scale;

  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip bg-brand-bg text-brand-text">
      <div className="px-6 pt-[calc(env(safe-area-inset-top)+2.5rem)] text-center">
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight">
          Here&apos;s what {brandName} could look like
        </h1>
        <p className="mx-auto mt-2 max-w-[36ch] text-[15px] leading-relaxed text-brand-text/60">
          Real Oakmonte storefronts. Pick your look any time from{" "}
          <span className="font-medium text-brand-text">Customise your store front</span>.
        </p>
      </div>

      {vw > 0 && (
        <div
          // my-auto: centred in whatever height is left over, rather than
          // hanging under the heading with an empty band above Finish (tall
          // screens — tablets — leave a lot over).
          className={`relative my-auto pt-8 flex justify-center ${fan ? "" : "items-end"}`}
          style={{ gap: fan ? 0 : GAP, height: fan ? PHONE_H * scale + 70 : undefined }}
        >
          {looks.map(({ theme, motion, hero }, i) => {
            // Fan: the middle phone in front, the other two behind and to the side.
            const side = i - 1;
            const fanStyle = fan
              ? {
                  position: "absolute" as const,
                  left: "50%",
                  // In pixels from the phone itself, so the side phones sit at the
                  // same distance either way (a % would follow the caption too).
                  width: phoneW,
                  marginLeft: -phoneW / 2 + side * phoneW * FAN_OFFSET,
                  transform: `rotate(${side * 7}deg) scale(${side === 0 ? 1 : 0.88})`,
                  zIndex: side === 0 ? 2 : 1,
                  transformOrigin: "bottom center",
                }
              : undefined;
            return (
              <figure key={theme.id} style={fanStyle} className="m-0">
                <PhonePreview
                  themeId={theme.id}
                  brandName={brandName}
                  scale={scale}
                  motion={motion}
                  // In the fan the phones keep one shared angle, so no drift of its own.
                  drift={!fan}
                  hero={hero}
                />
                {/* In the fan only the front phone has a caption: a side phone's box is
                    just the phone, so both turn about the same point. */}
                {(!fan || side === 0) && (
                  // Wider than the phone it sits under: boxed to the phone's
                  // width, the eyebrow broke one word a line on short screens
                  // and ran into the Finish button.
                  <figcaption className="relative left-1/2 mt-3 w-max -translate-x-1/2 whitespace-nowrap text-center">
                    <p className="text-[14px] font-semibold">{theme.name}</p>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-brand-text/50">
                      {theme.eyebrow}
                    </p>
                  </figcaption>
                )}
              </figure>
            );
          })}
        </div>
      )}

      <div className="mt-auto px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-6">
        <button
          type="button"
          onClick={() => navigate({ to: "/store", replace: true })}
          className="mx-auto flex h-14 w-full max-w-sm items-center justify-center rounded-full bg-brand-accent text-[16px] font-semibold text-brand-bg shadow-[0_6px_16px_-8px_rgba(0,0,0,0.35)] transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_18px_32px_-12px_rgba(0,0,0,0.45)] active:translate-y-0 active:scale-[0.98]"
        >
          Finish set up
        </button>
      </div>
    </div>
  );
}

/** One storefront in a phone frame, with the storefront's store / feed /
 *  messages pill at the bottom, moving its own way (see Motion). */
function PhonePreview({
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
    <div
      className={`relative overflow-hidden rounded-[2.5rem] border-[3px] border-neutral-900 bg-neutral-900 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)] ${
        motion === "float" && drift ? "oak-phone-float" : ""
      }`}
      // zoom, not transform: the frame takes only its drawn size.
      style={{ width: PHONE_W, height: PHONE_H, zoom: scale }}
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
                <span className={`${GLASS_RIM} absolute inset-0 rounded-full`} style={glassLens} />
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
  );
}
