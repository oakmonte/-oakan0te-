import { Check, ChevronRight, CirclePlay, Grid2X2, Heart, ShoppingBag, Sparkles, Stars } from "lucide-react";
import { useState, type ReactNode } from "react";

type ThemeId = "motion" | "banner" | "story";

type Theme = {
  id: ThemeId;
  name: string;
  eyebrow: string;
  description: string;
  accent: string;
};

const THEMES: Theme[] = [
  {
    id: "motion",
    name: "Motion Grid",
    eyebrow: "Dynamic · bold · streetwear",
    description: "Built for drops, statements, and products that need to move fast.",
    accent: "#9c4dff",
  },
  {
    id: "banner",
    name: "Immersive Banner",
    eyebrow: "Premium · cinematic · refined",
    description: "A spacious editorial storefront that puts your world front and centre.",
    accent: "#a67c52",
  },
  {
    id: "story",
    name: "Interactive Story",
    eyebrow: "Social · expressive · engaging",
    description: "Turn products, campaigns, and creator moments into a living feed.",
    accent: "#ec4b9a",
  },
];

export function StoreThemeSelector() {
  const [selected, setSelected] = useState<ThemeId>("motion");

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-[#f6f5f2] px-4 py-7 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8b735b]">
              Storefront design
            </p>
            <h1 className="text-2xl font-semibold tracking-[-0.04em] text-[#171717] sm:text-3xl">
              Pick a store theme
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#6b6862]">
              Give your store a point of view. Every template is made for products first, and you can switch at any time.
            </p>
          </div>
          <div className="rounded-full border border-[#dfdcd5] bg-white px-3.5 py-2 text-xs text-[#6b6862] shadow-sm">
            3 original storefronts
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {THEMES.map((theme) => {
            const isSelected = selected === theme.id;
            return (
              <article
                key={theme.id}
                className={`overflow-hidden rounded-[1.6rem] border bg-white p-3 shadow-[0_12px_35px_rgba(36,31,24,0.07)] transition-all duration-300 ${
                  isSelected ? "border-[#1d1c1a] ring-1 ring-[#1d1c1a]" : "border-[#e4e0d9] hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(36,31,24,0.13)]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelected(theme.id)}
                  className="block w-full rounded-[1.1rem] text-left focus:outline-none"
                  aria-pressed={isSelected}
                  aria-label={`Select ${theme.name}`}
                >
                  <StorefrontPreview theme={theme.id} />
                </button>

                <div className="px-2 pb-2 pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold tracking-[-0.025em] text-[#1c1b19]">{theme.name}</p>
                      <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.11em] text-[#8d8981]">{theme.eyebrow}</p>
                    </div>
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
                        isSelected ? "border-transparent text-white" : "border-[#dbd7d0] text-transparent"
                      }`}
                      style={{ backgroundColor: isSelected ? theme.accent : "transparent" }}
                      aria-hidden="true"
                    >
                      <Check size={14} strokeWidth={3} />
                    </span>
                  </div>
                  <p className="mt-3 min-h-10 text-sm leading-5 text-[#706c65]">{theme.description}</p>
                  <button
                    type="button"
                    onClick={() => setSelected(theme.id)}
                    className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#e1ddd6] py-2.5 text-sm font-medium text-[#262421] transition-colors hover:bg-[#f5f3ef]"
                  >
                    {isSelected ? "Selected" : "Use this theme"}
                    {!isSelected && <ChevronRight size={16} />}
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <p className="mt-6 text-center text-xs text-[#8c8881]">
          Your storefront content stays yours — a theme only changes how it is presented.
        </p>
      </div>
    </main>
  );
}

function StorefrontPreview({ theme }: { theme: ThemeId }) {
  if (theme === "motion") return <MotionGridPreview />;
  if (theme === "banner") return <ImmersiveBannerPreview />;
  return <InteractiveStoryPreview />;
}

function PreviewHeader({ dark = false }: { dark?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.16em] ${dark ? "text-white/75" : "text-[#24201b]/70"}`}>
      <span>Offgrid</span>
      <div className="flex items-center gap-3">
        <span>Shop</span>
        <ShoppingBag size={12} strokeWidth={1.8} />
      </div>
    </div>
  );
}

function MotionGridPreview() {
  return (
    <div className="relative min-h-[390px] overflow-hidden rounded-[1.1rem] bg-[#09070d] text-white">
      <div className="absolute inset-0 opacity-45 [background-image:linear-gradient(rgba(157,77,255,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(157,77,255,0.2)_1px,transparent_1px)] [background-size:24px_24px]" />
      <div className="absolute -left-14 top-12 h-40 w-40 rounded-full bg-[#722ee8]/30 blur-3xl" />
      <div className="absolute right-0 top-28 h-32 w-32 rounded-full bg-[#b673ff]/20 blur-3xl" />
      <div className="relative">
        <PreviewHeader dark />
        <div className="px-4 pt-7">
          <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-[#c9a3ff]">The next drop is live</p>
          <h2 className="mt-2 max-w-[210px] font-display text-[39px] leading-[0.83] uppercase tracking-[-0.05em]">
            Made to be seen.
          </h2>
          <span className="mt-5 inline-block rounded-full bg-[#9c4dff] px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.12em] shadow-[0_0_25px_rgba(156,77,255,0.7)]">
            Shop the drop
          </span>
        </div>
        <div className="mx-4 mt-8 flex items-center justify-between border-y border-white/10 py-3 text-[9px] font-medium uppercase tracking-[0.09em] text-white/70">
          <span>New arrivals</span>
          <span>24 pieces</span>
          <span className="text-[#bd91ff]">View all</span>
        </div>
        <div className="grid grid-cols-3 gap-2 px-4 pt-3">
          <MotionProduct label="Oxy tee" tint="from-[#311a59] to-[#13111c]" />
          <MotionProduct label="Run it cap" tint="from-[#3e215c] to-[#17131d]" />
          <MotionProduct label="State bag" tint="from-[#191222] to-[#47217b]" />
        </div>
        <div className="mx-4 mt-4 flex items-center justify-between rounded-xl border border-[#9c4dff]/40 bg-[#25113c]/70 px-3 py-2.5 text-[10px]">
          <span className="font-semibold">Limited drop</span>
          <span className="text-[#d6bdff]">04 : 22 : 16</span>
        </div>
      </div>
    </div>
  );
}

function MotionProduct({ label, tint }: { label: string; tint: string }) {
  return (
    <div className={`relative h-28 overflow-hidden rounded-lg bg-gradient-to-br ${tint} p-2`}>
      <div className="absolute left-1/2 top-4 h-16 w-10 -translate-x-1/2 rounded-t-[1.1rem] rounded-b-md border border-white/20 bg-white/10 shadow-lg" />
      <div className="absolute bottom-2 left-2 text-[9px] font-semibold">{label}</div>
    </div>
  );
}

function ImmersiveBannerPreview() {
  return (
    <div className="relative min-h-[390px] overflow-hidden rounded-[1.1rem] bg-[#e9e0d1] text-[#292219]">
      <div className="absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_80%_10%,rgba(255,255,255,0.8),transparent_25%),linear-gradient(125deg,#c2aa8c_0%,#f1e8dc_48%,#b3a284_100%)]" />
      <div className="absolute right-8 top-20 h-44 w-14 rounded-t-[3rem] rounded-b-[1.4rem] bg-[#6b5945]/80 shadow-[-12px_18px_25px_rgba(52,40,26,0.22)]" />
      <div className="absolute right-[3.1rem] top-[3.9rem] h-20 w-[2px] rotate-[-12deg] bg-[#6e604d]" />
      <div className="absolute right-[1.6rem] top-[4.5rem] h-16 w-[2px] rotate-[18deg] bg-[#6e604d]" />
      <div className="relative">
        <PreviewHeader />
        <div className="px-4 pt-9 text-center">
          <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-[#695947]">Objects for living</p>
          <h2 className="mt-2 font-serif text-[48px] leading-none tracking-[-0.055em]">Terra</h2>
          <div className="mx-auto mt-3 h-px w-16 bg-[#a48a68]" />
          <p className="mx-auto mt-3 max-w-36 text-[10px] leading-4 text-[#655747]">Quiet pieces for every corner of your day.</p>
        </div>
        <div className="relative mt-12 bg-[#f7f2e9] px-4 pb-4 pt-4">
          <div className="grid grid-cols-4 gap-1.5 rounded-xl bg-[#ded2c1]/70 p-2 text-center text-[8px] leading-3 text-[#524638]">
            <PreviewFeature icon={<Sparkles size={11} />} text="Thoughtful" />
            <PreviewFeature icon={<Stars size={11} />} text="Considered" />
            <PreviewFeature icon={<Heart size={11} />} text="Made well" />
            <PreviewFeature icon={<Check size={11} />} text="Lasting" />
          </div>
          <div className="mt-5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.1em]">
            <span>Shop by room</span>
            <span className="text-[#8b735b]">Explore</span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <BannerProduct label="Home" shape="rounded-full" />
            <BannerProduct label="Linen" shape="rounded-t-[1.8rem]" />
            <BannerProduct label="Objects" shape="rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewFeature({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-1 py-1">
      {icon}
      <span>{text}</span>
    </div>
  );
}

function BannerProduct({ label, shape }: { label: string; shape: string }) {
  return (
    <div className="h-16 overflow-hidden rounded-lg bg-[#d8c8b4] p-1.5">
      <div className={`h-9 bg-[#aa9172]/60 ${shape}`} />
      <p className="mt-1 text-[8px] font-medium uppercase tracking-[0.06em]">{label}</p>
    </div>
  );
}

function InteractiveStoryPreview() {
  return (
    <div className="relative min-h-[390px] overflow-hidden rounded-[1.1rem] bg-[#171018] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_12%,rgba(255,105,180,0.2),transparent_28%),radial-gradient(circle_at_8%_43%,rgba(136,88,255,0.26),transparent_34%)]" />
      <div className="relative">
        <PreviewHeader dark />
        <div className="px-4 pt-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#ff9bc8] via-[#ec4b9a] to-[#7144e8] p-[2px]">
              <div className="flex h-full w-full items-center justify-center rounded-full bg-[#241520] text-[13px] font-bold">S</div>
            </div>
            <div>
              <p className="text-sm font-semibold tracking-[-0.03em]">Sunday Social</p>
              <p className="text-[9px] text-white/55">Your everyday moodboard</p>
            </div>
            <span className="ml-auto rounded-full bg-white/10 px-2.5 py-1 text-[8px] font-semibold">Follow</span>
          </div>

          <div className="mt-5 flex gap-2 overflow-hidden">
            <StoryBubble label="New in" tint="from-[#f060a9] to-[#743ed7]" />
            <StoryBubble label="Studio" tint="from-[#ffb47a] to-[#e75383]" />
            <StoryBubble label="On film" tint="from-[#6c62ef] to-[#2b9ddf]" />
            <StoryBubble label="Fits" tint="from-[#bb64eb] to-[#ec4b9a]" />
          </div>
        </div>
        <div className="mt-5 border-t border-white/10 px-4 pt-3">
          <div className="flex items-center justify-between text-[10px]">
            <span className="font-semibold">Shop the edit</span>
            <span className="text-[#ff8fc4]">See all</span>
          </div>
          <div className="mt-3 grid grid-cols-[1.08fr_.92fr] gap-2">
            <div className="relative h-32 overflow-hidden rounded-xl bg-gradient-to-br from-[#f281b8] via-[#6f3fd2] to-[#22142d] p-3">
              <span className="rounded-full bg-white/20 px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.1em]">New drop</span>
              <p className="absolute bottom-3 text-xl font-semibold leading-none tracking-[-0.06em]">Colour after dark.</p>
            </div>
            <div className="grid gap-2">
              <StoryTile label="Layered" tint="from-[#f8a7ca] to-[#6a3bbd]" />
              <StoryTile label="Sunday bag" tint="from-[#f7bb8d] to-[#c64c7c]" />
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-around border-t border-white/10 py-3 text-white/55">
          <Grid2X2 size={15} className="text-[#ff70b5]" />
          <CirclePlay size={16} />
          <Sparkles size={15} />
          <Heart size={15} />
        </div>
      </div>
    </div>
  );
}

function StoryBubble({ label, tint }: { label: string; tint: string }) {
  return (
    <div className="shrink-0 text-center">
      <div className={`h-10 w-10 rounded-full bg-gradient-to-br ${tint} p-[2px]`}>
        <div className="h-full w-full rounded-full bg-[#1d1420]" />
      </div>
      <span className="mt-1 block text-[8px] text-white/75">{label}</span>
    </div>
  );
}

function StoryTile({ label, tint }: { label: string; tint: string }) {
  return (
    <div className={`relative h-[60px] overflow-hidden rounded-lg bg-gradient-to-br ${tint}`}>
      <span className="absolute bottom-1.5 left-2 text-[8px] font-semibold">{label}</span>
    </div>
  );
}
