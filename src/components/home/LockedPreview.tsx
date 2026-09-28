// Blurred, untappable stand-ins for /home's Shop and Explore tabs until they go
// live. Rebuilt from the Figma "Oakmonte landing page" frames (Shop 14:1476,
// Explore 20:282). The blur is baked into the images (64px-wide pre-blurred
// WebPs, a few hundred bytes each, inlined by Vite) rather than a CSS filter
// over the whole page: a big blur() over a tall scrolling layer was visibly
// slow to paint on phones. Only the few text blocks keep a CSS blur, and
// they're small. Page colours use chat-* tokens so this follows the phone's
// light/dark setting; text on the hero photo stays light in both.
import heroImg from "@/assets/home-preview/shop-hero.webp";
import hoodiePink from "@/assets/home-preview/shop-hoodie-pink.webp";
import hoodieTan from "@/assets/home-preview/shop-hoodie-tan.webp";
import explore1 from "@/assets/home-preview/explore-1.webp";
import explore2 from "@/assets/home-preview/explore-2.webp";
import explore3 from "@/assets/home-preview/explore-3.webp";
import explore5 from "@/assets/home-preview/explore-5.webp";
import explore6 from "@/assets/home-preview/explore-6.webp";
import explore7 from "@/assets/home-preview/explore-7.webp";
import explore8 from "@/assets/home-preview/explore-8.webp";
// The store-theme slideshow placeholders, recompressed -- extra length for the feed.
import explore9 from "@/assets/home-preview/explore-9.webp";
import explore10 from "@/assets/home-preview/explore-10.webp";
import explore11 from "@/assets/home-preview/explore-11.webp";
import explore12 from "@/assets/home-preview/explore-12.webp";

// Figma crops images inside their frame by oversizing them; percentages are
// straight from the design. Without a crop the image just covers the frame.
type Crop = { w: number; h: number; l: number; t: number };

function CroppedImg({ src, crop }: { src: string; crop?: Crop }) {
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      className={crop ? "absolute max-w-none" : "absolute inset-0 h-full w-full object-cover"}
      style={
        crop
          ? { width: `${crop.w}%`, height: `${crop.h}%`, left: `${crop.l}%`, top: `${crop.t}%` }
          : undefined
      }
    />
  );
}

const SHELF_CARDS: { src: string; crop: Crop; white?: boolean }[] = [
  { src: hoodiePink, crop: { w: 125.35, h: 91.72, l: -11.17, t: 3.25 }, white: true },
  { src: hoodieTan, crop: { w: 205.29, h: 100.03, l: -52.66, t: 0.13 } },
];

export function ShopPreview() {
  return (
    <div>
      <div className="relative aspect-[440/846] w-full overflow-hidden rounded-b-[5px]">
        <CroppedImg src={heroImg} crop={{ w: 108.15, h: 100, l: -7.17, t: 0 }} />
        <div className="absolute left-[42px] top-[70%] flex flex-col gap-[10px] blur-[10px]">
          <div className="flex flex-col gap-[20px]">
            <p
              className="flex h-[35px] items-center text-[48px] font-black leading-[27px] tracking-[-0.43px] text-[#f2f1ef]"
              style={{ fontFamily: "Inter, system-ui", textShadow: "4px 4px 4px rgba(0,0,0,0.25)" }}
            >
              Diana’s Secret
            </p>
            <p
              className="text-[15px] font-black italic leading-[27px] tracking-[-0.43px] text-[#c8c8c8]"
              style={{ fontFamily: "Inter, system-ui" }}
            >
              Exclusively Divas
            </p>
          </div>
          <div className="flex items-end gap-[21px] text-[15px] leading-5 tracking-[-0.23px] text-white">
            <span className="flex h-[50px] w-[98px] items-center justify-center rounded-full bg-[#9f7c5d]">
              Learn more
            </span>
            <span
              className="flex h-[50px] w-[89px] items-center justify-center rounded-full border border-[#876543]"
              style={{ textShadow: "0 4px 4px rgba(0,0,0,0.25)" }}
            >
              Shop
            </span>
          </div>
        </div>
      </div>

      <div className="pl-[9px]">
        <h2 className="flex h-[60px] items-center text-[30px] font-bold tracking-[-1px] blur-[10px]">
          Hoodie shelf
        </h2>
        <div className="flex gap-[15px] overflow-hidden">
          {SHELF_CARDS.map((card, i) => (
            <div key={i} className="flex w-[227px] shrink-0 flex-col gap-[5px]">
              <div
                className={`relative h-[310px] overflow-hidden rounded-[14px] ${card.white ? "bg-white" : ""}`}
              >
                <CroppedImg src={card.src} crop={card.crop} />
              </div>
              <div className="w-[182px] font-bold tracking-[-1px] blur-[8px]">
                <p className="h-[27px] text-center text-[20px]">Pink summerhoodie</p>
                <p className="px-[3px] text-[16px]">30,000</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type Tile = { src: string; ratio: string; radius: number; crop?: Crop; mt?: number };

// Column gaps are 10px (left) and 9px (right) in the design, except the first
// pair in each column, which Figma spaces at 7px and 15px -- hence the mt.
const EXPLORE_LEFT: Tile[] = [
  { src: explore1, ratio: "200/191", radius: 7, crop: { w: 100, h: 150.77, l: -0.25, t: -30.1 } },
  {
    src: explore2,
    ratio: "201/275",
    radius: 7,
    crop: { w: 106.07, h: 100, l: -6.24, t: 0 },
    mt: -3,
  },
  { src: explore3, ratio: "200/234", radius: 15, crop: { w: 102.67, h: 100.4, l: -0.06, t: -0.2 } },
  {
    src: heroImg,
    ratio: "187/341",
    radius: 15,
    crop: { w: 102.67, h: 100.06, l: -2.67, t: -0.03 },
  },
  { src: explore9, ratio: "883/1280", radius: 13 },
  { src: explore11, ratio: "853/1280", radius: 13 },
];
const EXPLORE_RIGHT: Tile[] = [
  { src: explore5, ratio: "194/263", radius: 7, crop: { w: 120.24, h: 100, l: -11.83, t: 0 } },
  { src: explore6, ratio: "194/195", radius: 7, mt: 6 },
  { src: explore7, ratio: "474/842", radius: 13 },
  { src: explore8, ratio: "1200/1599", radius: 10 },
  { src: explore10, ratio: "837/1280", radius: 13 },
  { src: explore12, ratio: "854/1280", radius: 13 },
];

function ExploreColumn({ tiles, gap }: { tiles: Tile[]; gap: number }) {
  return (
    <div className="flex flex-col" style={{ gap }}>
      {tiles.map((tile, i) => (
        <div
          key={i}
          className="relative w-full overflow-hidden"
          style={{ aspectRatio: tile.ratio, borderRadius: tile.radius, marginTop: tile.mt }}
        >
          <CroppedImg src={tile.src} crop={tile.crop} />
        </div>
      ))}
    </div>
  );
}

export function ExplorePreview() {
  return (
    <div className="grid grid-cols-[200fr_194fr] gap-x-5 px-3 pt-[88px]">
      <ExploreColumn tiles={EXPLORE_LEFT} gap={10} />
      <ExploreColumn tiles={EXPLORE_RIGHT} gap={9} />
    </div>
  );
}
