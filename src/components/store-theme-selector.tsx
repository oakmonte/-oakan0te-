import {
  Check,
  ChevronRight,
  Cpu,
  Crown,
  Gem,
  Heart,
  Hexagon,
  Layers,
  Leaf,
  Moon,
  Pencil,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Stars,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { THEMES, type ThemeId } from "./store-themes/types";
import { ThemePreviewSheet } from "./store-themes/full-previews";
import { useStoreTheme } from "./store-themes/useStoreTheme";

export function StoreThemeSelector() {
  const { themeId: selected, selectTheme } = useStoreTheme();
  const [previewing, setPreviewing] = useState<ThemeId | null>(null);
  const [previewMode, setPreviewMode] = useState<"view" | "edit">("view");

  const previewTheme = THEMES.find((t) => t.id === previewing) ?? null;

  function openPreview(themeId: ThemeId, mode: "view" | "edit") {
    setPreviewing(themeId);
    setPreviewMode(mode);
  }

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
              Give your store a point of view. Every template is made for products first, and you
              can switch at any time.
            </p>
          </div>
          <div className="rounded-full border border-[#dfdcd5] bg-white px-3.5 py-2 text-xs text-[#6b6862] shadow-sm">
            {THEMES.length} original storefronts
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {THEMES.map((theme) => {
            const isSelected = selected === theme.id;
            return (
              <article
                key={theme.id}
                className={`overflow-hidden rounded-[1.6rem] border bg-white p-3 shadow-[0_12px_35px_rgba(36,31,24,0.07)] transition-all duration-300 ${
                  isSelected
                    ? "border-[#1d1c1a] ring-1 ring-[#1d1c1a]"
                    : "border-[#e4e0d9] hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(36,31,24,0.13)]"
                }`}
              >
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => void selectTheme(theme.id)}
                    className="block w-full rounded-[1.1rem] text-left focus:outline-none"
                    aria-pressed={isSelected}
                    aria-label={`Select ${theme.name}`}
                  >
                    <StorefrontPreview theme={theme.id} demoBrand={theme.demoBrand} />
                  </button>
                </div>

                <div className="px-2 pb-2 pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold tracking-[-0.025em] text-[#1c1b19]">
                        {theme.name}
                      </p>
                      <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.11em] text-[#8d8981]">
                        {theme.eyebrow}
                      </p>
                    </div>
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors duration-200 ${
                        isSelected
                          ? "border-transparent text-white"
                          : "border-[#dbd7d0] text-transparent"
                      }`}
                      style={{ backgroundColor: isSelected ? theme.accent : "transparent" }}
                      aria-hidden="true"
                    >
                      <Check
                        size={14}
                        strokeWidth={3}
                        className={isSelected ? "oak-motion-pop" : ""}
                      />
                    </span>
                  </div>
                  <p className="mt-3 min-h-10 text-sm leading-5 text-[#706c65]">
                    {theme.description}
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => openPreview(theme.id, "edit")}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-[#e1ddd6] py-2.5 text-sm font-medium text-[#262421] transition-colors duration-200 hover:bg-[#f5f3ef]"
                    >
                      <Pencil size={14} />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => openPreview(theme.id, "view")}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-[#e1ddd6] py-2.5 text-sm font-medium text-[#262421] transition-colors duration-200 hover:bg-[#f5f3ef]"
                    >
                      Preview
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => void selectTheme(theme.id)}
                    className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#e1ddd6] py-2.5 text-sm font-medium text-[#262421] transition-colors duration-200 hover:bg-[#f5f3ef]"
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

      {previewTheme && (
        <ThemePreviewSheet
          theme={previewTheme}
          isSelected={selected === previewTheme.id}
          initialMode={previewMode}
          onClose={() => setPreviewing(null)}
          onSelect={() => {
            void selectTheme(previewTheme.id);
            setPreviewing(null);
          }}
        />
      )}
    </main>
  );
}

function StorefrontPreview({ theme, demoBrand }: { theme: ThemeId; demoBrand: string }) {
  if (theme === "motion") return <MotionGridPreview brand={demoBrand} />;
  if (theme === "banner") return <ImmersiveBannerPreview brand={demoBrand} />;
  if (theme === "atelier") return <GalleryEditPreview brand={demoBrand} />;
  if (theme === "circuit") return <NeonTerminalPreview brand={demoBrand} />;
  if (theme === "verdant") return <VerdantNoirPreview brand={demoBrand} />;
  if (theme === "monochrome") return <MonochromePreview brand={demoBrand} />;
  if (theme === "gilded") return <GildedPreview brand={demoBrand} />;
  return <ObsidianPreview brand={demoBrand} />;
}

function PreviewHeader({ dark = false, brand }: { dark?: boolean; brand: string }) {
  return (
    <div
      className={`flex items-center justify-between px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.16em] ${dark ? "text-white/75" : "text-[#24201b]/70"}`}
    >
      <span>{brand}</span>
      <div className="flex items-center gap-3">
        <span>Shop</span>
        <ShoppingBag size={12} strokeWidth={1.8} />
      </div>
    </div>
  );
}

function MotionGridPreview({ brand }: { brand: string }) {
  return (
    <div className="relative min-h-[390px] overflow-hidden rounded-[1.1rem] bg-[#09070d] text-white">
      <div className="absolute inset-0 opacity-45 [background-image:linear-gradient(rgba(157,77,255,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(157,77,255,0.2)_1px,transparent_1px)] [background-size:24px_24px]" />
      <div className="absolute -left-14 top-12 h-40 w-40 rounded-full bg-[#722ee8]/30 blur-3xl" />
      <div className="absolute right-0 top-28 h-32 w-32 rounded-full bg-[#b673ff]/20 blur-3xl" />
      <div className="relative">
        <PreviewHeader dark brand={brand} />
        <div className="px-4 pt-7">
          <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-[#c9a3ff]">
            The next drop is live
          </p>
          <h2 className="mt-2 max-w-[210px] font-display text-[39px] leading-[0.83] uppercase tracking-[-0.05em]">
            Made to be seen.
          </h2>
          <span className="mt-5 inline-block rounded-full bg-[#9c4dff] px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.12em] shadow-[0_0_25px_rgba(156,77,255,0.7)]">
            Shop the drop
          </span>
        </div>
        <div className="mx-4 mt-8 flex items-center justify-between border-y border-white/10 py-3 text-[9px] font-medium uppercase tracking-[0.09em] text-white/70">
          <span>New arrivals</span>
          <span>12 pieces</span>
          <span className="text-[#bd91ff]">View all</span>
        </div>
        <div className="grid grid-cols-3 gap-2 px-4 pt-3">
          <MotionProduct label="Oxy tee" tint="from-[#311a59] to-[#13111c]" />
          <MotionProduct label="Run it cap" tint="from-[#3e215c] to-[#17131d]" />
          <MotionProduct label="State bag" tint="from-[#191222] to-[#47217b]" />
        </div>
        <div className="mx-4 mt-4 flex items-center justify-between rounded-xl border border-[#9c4dff]/40 bg-[#25113c]/70 px-3 py-2.5 text-[10px]">
          <span className="font-semibold">Limited drop</span>
          <span className="text-[#d6bdff]">02 : 18 : 47</span>
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

function ImmersiveBannerPreview({ brand }: { brand: string }) {
  return (
    <div className="relative min-h-[390px] overflow-hidden rounded-[1.1rem] bg-[#e9e0d1] text-[#292219]">
      <div className="absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_80%_10%,rgba(255,255,255,0.8),transparent_25%),linear-gradient(125deg,#c2aa8c_0%,#f1e8dc_48%,#b3a284_100%)]" />
      <div className="absolute right-8 top-20 h-44 w-14 rounded-t-[3rem] rounded-b-[1.4rem] bg-[#6b5945]/80 shadow-[-12px_18px_25px_rgba(52,40,26,0.22)]" />
      <div className="absolute right-[3.1rem] top-[3.9rem] h-20 w-[2px] rotate-[-12deg] bg-[#6e604d]" />
      <div className="absolute right-[1.6rem] top-[4.5rem] h-16 w-[2px] rotate-[18deg] bg-[#6e604d]" />
      <div className="relative">
        <PreviewHeader brand={brand} />
        <div className="px-4 pt-9 text-center">
          <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-[#695947]">
            Objects for living
          </p>
          <h2 className="mt-2 font-serif text-[48px] leading-none tracking-[-0.055em]">terra</h2>
          <div className="mx-auto mt-3 h-px w-16 bg-[#a48a68]" />
          <p className="mx-auto mt-3 max-w-36 text-[10px] leading-4 text-[#655747]">
            Quiet pieces for every corner of your day.
          </p>
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

function GalleryEditPreview({ brand }: { brand: string }) {
  return (
    <div className="relative min-h-[390px] overflow-hidden rounded-[1.1rem] bg-[#0c0b0a] text-[#f3ede2]">
      <div className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_78%_0%,rgba(201,162,39,0.18),transparent_45%)]" />
      <div className="absolute inset-0 [background-image:linear-gradient(115deg,transparent_35%,rgba(201,162,39,0.06)_50%,transparent_65%)]" />
      <div className="relative">
        <PreviewHeader dark brand={brand} />
        <div className="px-4 pt-9 text-center">
          <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-[#c9a227]">
            Autumn selects, in full
          </p>
          <h2 className="mt-2.5 font-serif text-[34px] italic leading-none tracking-[-0.02em]">
            Atelier Noir
          </h2>
          <div className="mx-auto mt-3 h-px w-12 bg-[#c9a227]/60" />
          <p className="mx-auto mt-3 max-w-40 text-[10px] leading-4 text-[#c9bea6]">
            Fewer pieces. Finer edit.
          </p>
        </div>
        <div className="mt-9 px-4">
          <div className="grid grid-cols-3 gap-2">
            <GalleryProduct label="Coat" />
            <GalleryProduct label="Tailored" />
            <GalleryProduct label="Object" />
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-[#c9a227]/20 pt-3 text-[9px] font-medium uppercase tracking-[0.08em]">
            <span>This week's edit</span>
            <span className="text-[#c9a227]">View</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function GalleryProduct({ label }: { label: string }) {
  return (
    <div className="h-24 rounded-lg border border-[#c9a227]/25 bg-[#c9a227]/[0.04] p-2">
      <div className="h-12 rounded-md bg-[#c9a227]/10" />
      <p className="mt-2 text-[8px] font-medium uppercase tracking-[0.06em] text-[#c9bea6]">
        {label}
      </p>
    </div>
  );
}

function NeonTerminalPreview({ brand }: { brand: string }) {
  return (
    <div className="relative min-h-[390px] overflow-hidden rounded-[1.1rem] bg-[#05070a] text-[#eafcff]">
      <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(45,212,255,0.3)_1px,transparent_1px),linear-gradient(90deg,rgba(45,212,255,0.3)_1px,transparent_1px)] [background-size:18px_18px]" />
      <div className="absolute right-3 top-3 h-6 w-6 border-r-2 border-t-2 border-[#2dd4ff]/50" />
      <div className="absolute left-3 top-3 h-6 w-6 border-l-2 border-t-2 border-[#2dd4ff]/50" />
      <div className="relative">
        <PreviewHeader dark brand={brand} />
        <div className="px-4 pt-7 text-center">
          <p className="flex items-center justify-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.22em] text-[#2dd4ff]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#2dd4ff]" />
            System online
          </p>
          <h2
            className="mt-2 font-display text-[36px] uppercase leading-[0.85] tracking-[-0.02em]"
            style={{ textShadow: "0 0 16px rgba(45,212,255,0.5)" }}
          >
            Circuit
          </h2>
          <p className="mx-auto mt-2.5 max-w-40 text-[10px] leading-4 text-[#8fd9e8]">
            Style, compiled.
          </p>
        </div>
        <div className="mt-8 grid grid-cols-3 gap-2 px-4">
          <CircuitProduct icon={<Cpu size={16} />} />
          <CircuitProduct icon={<Gem size={16} />} />
          <CircuitProduct icon={<Crown size={16} />} />
        </div>
        <div className="mx-4 mt-4 flex items-center justify-between rounded-xl border border-[#2dd4ff]/35 bg-[#2dd4ff]/[0.06] px-3 py-2.5 text-[10px]">
          <span className="font-semibold">System update</span>
          <span className="flex items-center gap-1 text-[#2dd4ff]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2dd4ff]" />
            Live
          </span>
        </div>
      </div>
    </div>
  );
}

function CircuitProduct({ icon }: { icon: ReactNode }) {
  return (
    <div className="flex h-24 items-center justify-center rounded-lg border border-[#2dd4ff]/25 bg-[#2dd4ff]/[0.04] shadow-[0_0_18px_rgba(45,212,255,0.08)]">
      <span className="text-[#2dd4ff]">{icon}</span>
    </div>
  );
}

// Shared product tile for the four newer, calmer themes below — each just
// supplies its own palette instead of repeating the same markup.
function SwatchProduct({
  icon,
  borderColor,
  bgColor,
}: {
  icon: ReactNode;
  borderColor: string;
  bgColor: string;
}) {
  return (
    <div
      className="flex h-24 items-center justify-center rounded-lg border"
      style={{ borderColor, background: bgColor }}
    >
      {icon}
    </div>
  );
}

function VerdantNoirPreview({ brand }: { brand: string }) {
  return (
    <div className="relative min-h-[390px] overflow-hidden rounded-[1.1rem] bg-[#0a0f0b] text-[#eaf2ec]">
      <div className="absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_20%_0%,rgba(63,174,99,0.18),transparent_45%)]" />
      <div className="relative">
        <PreviewHeader dark brand={brand} />
        <div className="px-4 pt-7">
          <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-[#7fcf9a]">
            Grown, not manufactured
          </p>
          <h2 className="mt-2 max-w-[210px] font-serif text-[36px] leading-[0.9] tracking-[-0.03em]">
            Fern &amp; Co.
          </h2>
          <p className="mt-2 max-w-[190px] text-[11px] leading-4 text-[#c3d6ca]">
            Quiet colour for slow living.
          </p>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-2 px-4">
          <SwatchProduct
            icon={<Leaf size={16} color="#3fae63" />}
            borderColor="rgba(63,174,99,0.3)"
            bgColor="rgba(63,174,99,0.06)"
          />
          <SwatchProduct
            icon={<ShieldCheck size={16} color="#3fae63" />}
            borderColor="rgba(63,174,99,0.3)"
            bgColor="rgba(63,174,99,0.06)"
          />
          <SwatchProduct
            icon={<Sparkles size={16} color="#3fae63" />}
            borderColor="rgba(63,174,99,0.3)"
            bgColor="rgba(63,174,99,0.06)"
          />
        </div>
        <div className="mx-4 mt-4 flex items-center justify-between rounded-xl border border-[#3fae63]/30 bg-[#3fae63]/[0.06] px-3 py-2.5 text-[10px]">
          <span className="font-semibold">New season</span>
          <span className="text-[#7fcf9a]">Explore</span>
        </div>
      </div>
    </div>
  );
}

function MonochromePreview({ brand }: { brand: string }) {
  return (
    <div className="relative min-h-[390px] overflow-hidden rounded-[1.1rem] bg-[#fafafa] text-[#111111]">
      <div className="absolute inset-x-0 top-0 h-52 bg-[linear-gradient(135deg,#ffffff_0%,#e8e8e8_100%)]" />
      <div className="relative">
        <PreviewHeader brand={brand} />
        <div className="px-4 pt-8 text-center">
          <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-[#5a5a5a]">
            No colour to distract you
          </p>
          <h2 className="mt-2 font-display text-[32px] uppercase leading-[0.9] tracking-[-0.02em]">
            NOIR/BLANC
          </h2>
          <div className="mx-auto mt-3 h-px w-14 bg-[#111111]" />
        </div>
        <div className="mt-6 grid grid-cols-3 gap-2 px-4">
          <SwatchProduct
            icon={<Layers size={16} color="#111111" />}
            borderColor="rgba(17,17,17,0.15)"
            bgColor="rgba(17,17,17,0.04)"
          />
          <SwatchProduct
            icon={<Check size={16} color="#111111" />}
            borderColor="rgba(17,17,17,0.15)"
            bgColor="rgba(17,17,17,0.04)"
          />
          <SwatchProduct
            icon={<Hexagon size={16} color="#111111" />}
            borderColor="rgba(17,17,17,0.15)"
            bgColor="rgba(17,17,17,0.04)"
          />
        </div>
        <div className="mx-4 mt-4 flex items-center justify-between rounded-xl border border-[#111111]/15 bg-[#111111]/[0.03] px-3 py-2.5 text-[10px]">
          <span className="font-semibold">New arrivals</span>
          <span className="text-[#5a5a5a]">Shop now</span>
        </div>
      </div>
    </div>
  );
}

function GildedPreview({ brand }: { brand: string }) {
  return (
    <div className="relative min-h-[390px] overflow-hidden rounded-[1.1rem] bg-[#0d0904] text-[#f3ecdc]">
      <div className="absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_80%_0%,rgba(212,175,55,0.22),transparent_45%)]" />
      <div className="relative">
        <PreviewHeader dark brand={brand} />
        <div className="px-4 pt-8 text-center">
          <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-[#d4af37]">
            Opulence, quietly worn
          </p>
          <h2 className="mt-2.5 font-serif text-[32px] leading-none tracking-[-0.02em]">
            Aurum House
          </h2>
          <div className="mx-auto mt-3 h-px w-12 bg-[#d4af37]/60" />
        </div>
        <div className="mt-6 grid grid-cols-3 gap-2 px-4">
          <SwatchProduct
            icon={<Crown size={16} color="#d4af37" />}
            borderColor="rgba(212,175,55,0.35)"
            bgColor="rgba(212,175,55,0.06)"
          />
          <SwatchProduct
            icon={<Gem size={16} color="#d4af37" />}
            borderColor="rgba(212,175,55,0.35)"
            bgColor="rgba(212,175,55,0.06)"
          />
          <SwatchProduct
            icon={<Sparkles size={16} color="#d4af37" />}
            borderColor="rgba(212,175,55,0.35)"
            bgColor="rgba(212,175,55,0.06)"
          />
        </div>
        <div className="mx-4 mt-4 flex items-center justify-between rounded-xl border border-[#d4af37]/35 bg-[#d4af37]/[0.06] px-3 py-2.5 text-[10px]">
          <span className="font-semibold">By invitation</span>
          <span className="text-[#d4af37]">Enter</span>
        </div>
      </div>
    </div>
  );
}

function ObsidianPreview({ brand }: { brand: string }) {
  return (
    <div className="relative min-h-[390px] overflow-hidden rounded-[1.1rem] bg-[#030303] text-[#e6e6e6]">
      <div className="absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.06),transparent_55%)]" />
      <div className="relative">
        <PreviewHeader dark brand={brand} />
        <div className="px-4 pt-8">
          <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-[#7a7a7a]">
            Nothing extra
          </p>
          <h2 className="mt-2 max-w-[210px] font-display text-[34px] uppercase leading-[0.85] tracking-[-0.03em]">
            VOID
          </h2>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-2 px-4">
          <SwatchProduct
            icon={<Moon size={16} color="#9a9a9a" />}
            borderColor="rgba(255,255,255,0.12)"
            bgColor="rgba(255,255,255,0.03)"
          />
          <SwatchProduct
            icon={<Hexagon size={16} color="#9a9a9a" />}
            borderColor="rgba(255,255,255,0.12)"
            bgColor="rgba(255,255,255,0.03)"
          />
          <SwatchProduct
            icon={<ShieldCheck size={16} color="#9a9a9a" />}
            borderColor="rgba(255,255,255,0.12)"
            bgColor="rgba(255,255,255,0.03)"
          />
        </div>
        <div className="mx-4 mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[10px]">
          <span className="font-semibold">Almost nothing left</span>
          <span className="text-[#9a9a9a]">See it</span>
        </div>
      </div>
    </div>
  );
}
