import { createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { Play } from "lucide-react";
import { CURATED_PLAYLISTS, thumbUrl } from "@/lib/curated-playlists";
import { BackButton } from "@/components/BackButton";

export const Route = createFileRoute("/store/playlists/$id")({
  loader: ({ params }) => {
    const playlist = CURATED_PLAYLISTS.find((p) => p.id === params.id);
    if (!playlist) throw notFound();
    return playlist;
  },
  component: PlaylistPage,
});

function PlaylistPage() {
  const playlist = Route.useLoaderData();
  return (
    <div className="flex flex-col gap-5 px-4 pb-[calc(env(safe-area-inset-bottom)+2.5rem)] pt-3 font-normal">
      <BackButton
        icon="chevron"
        size={18}
        label="Playlists"
        to={{ to: "/store/playlists" }}
        alwaysShow
        className="-ml-1 -mb-2 flex h-11 w-fit items-center gap-0.5 text-sm text-sd-ink-muted"
      />
      <header>
        <h1 className="sd-editorial text-[24px] leading-[1.1] tracking-[-0.02em] text-sd-ink">
          {playlist.title}
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-sd-ink-muted">
          {playlist.blurb} {playlist.videos.length} videos.
        </p>
      </header>
      <ol className="flex flex-col gap-6">
        {playlist.videos.map((v, i) => (
          <li key={v.id}>
            <VideoCard video={v} index={i + 1} />
          </li>
        ))}
      </ol>
    </div>
  );
}

/** A thumbnail until tapped, then the real player. A playlist can hold sixteen
 *  videos and each live YouTube embed costs a few hundred KB, so none are
 *  loaded until the seller picks one. */
function VideoCard({
  video,
  index,
}: {
  video: { id: string; title: string; channel: string };
  index: number;
}) {
  const [playing, setPlaying] = useState(false);
  return (
    <div>
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-sd-line bg-sd-surface">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&playsinline=1&rel=0`}
            title={video.title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="h-full w-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`Play ${video.title}`}
            className="group absolute inset-0 oak-motion-control active:scale-[0.99]"
          >
            <img
              src={thumbUrl(video.id)}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
            <span className="absolute inset-0 grid place-items-center bg-black/20">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-black/60">
                <Play size={20} className="translate-x-[1px] fill-white text-white" />
              </span>
            </span>
          </button>
        )}
      </div>
      <p className="mt-2 text-[15px] font-semibold leading-snug tracking-[-0.01em] text-sd-ink">
        {index}. {video.title}
      </p>
      <p className="mt-0.5 text-[13px] text-sd-ink-muted">{video.channel}</p>
    </div>
  );
}
