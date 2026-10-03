import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { CURATED_PLAYLISTS, thumbUrl } from "@/lib/curated-playlists";

export const Route = createFileRoute("/store/playlists/")({
  component: PlaylistsIndex,
});

function PlaylistsIndex() {
  return (
    <div className="flex flex-col gap-6 px-4 pb-[calc(env(safe-area-inset-bottom)+2.5rem)] pt-5 font-normal">
      <header>
        <h1 className="sd-editorial text-[26px] leading-[1.1] tracking-[-0.02em] text-sd-ink">
          Curated playlists
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-sd-ink-muted">
          Made by Oakmonte to help you design, source, market and grow your fashion brand.
        </p>
      </header>
      <ul className="flex flex-col gap-3">
        {CURATED_PLAYLISTS.map((p) => (
          <li key={p.id}>
            <Link
              to="/store/playlists/$id"
              params={{ id: p.id }}
              className="oak-tap flex items-center gap-3 rounded-2xl border border-sd-line bg-sd-surface p-3 oak-motion-control active:scale-[0.98]"
            >
              <img
                src={thumbUrl(p.videos[0].id)}
                alt=""
                loading="lazy"
                className="aspect-video w-[120px] shrink-0 rounded-xl bg-sd-soft object-cover"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold leading-snug tracking-[-0.01em] text-sd-ink">
                  {p.title}
                </span>
                <span className="mt-1 block text-[13px] text-sd-ink-muted">
                  {p.videos.length} videos
                </span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-sd-ink-muted" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
