import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/store/playlists")({
  component: Playlists,
});

// All five are public playlists on Oakmonte's own YouTube channel. Anything
// else on that channel is private on purpose -- only add an id here after
// checking the playlist is public and ours.
const PLAYLISTS = [
  { id: "PLDzTvKP_2IEQ", title: "The Art Of Fashion Design" },
  { id: "PLEBrtm36S40I", title: "A Complete Guide to Grow Your Clothing Brand in 2026" },
  { id: "PLfiJ5EMynbpE", title: "Marketing guide for fashion sellers" },
  { id: "PLM1-PS_fS4eA", title: "HOW I... For Fashion Brands" },
  { id: "PLVot20Llm6IA", title: "How To Get The Best Manufacturer For Your Clothing Brand" },
];

function Playlists() {
  return (
    <div className="flex flex-col gap-8 px-4 pb-[calc(env(safe-area-inset-bottom)+2.5rem)] pt-5 font-normal">
      <header>
        <h1 className="sd-editorial text-[26px] leading-[1.1] tracking-[-0.02em] text-sd-ink">
          Curated playlists
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-sd-ink-muted">
          Made by Oakmonte to help you design, source, market and grow your fashion brand.
        </p>
      </header>
      {PLAYLISTS.map((p, i) => (
        <section key={p.id} aria-label={p.title}>
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-sd-ink">{p.title}</h2>
          <div className="mt-3 aspect-video w-full overflow-hidden rounded-2xl border border-sd-line bg-sd-surface">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/videoseries?list=${p.id}`}
              title={p.title}
              loading={i === 0 ? "eager" : "lazy"}
              allow="encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              className="h-full w-full"
            />
          </div>
        </section>
      ))}
    </div>
  );
}
