import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAfterShotContext } from "@/lib/after-shot-context";
import { useAfterShotLayers, type Layer } from "@/lib/after-shot-layers";
import StudioEditor, { type StudioDone } from "@/components/studio/StudioEditor";
import { projectFrom } from "@/lib/studio/boot";
import { combineCredits } from "@/lib/studio/credits";
import { loadSource } from "@/lib/studio/sources";
import type { SourceMap, StudioProject } from "@/lib/studio/types";

export const Route = createFileRoute("/create/after-shot/studio")({
  head: () => ({ meta: [{ title: "Studio — Oakmonte" }] }),
  component: StudioRoute,
});

// The studio, opened from the after-shot screen's "Edit clips" on a camera
// capture. It hands its result back to /create/after-shot as a normal
// CapturedMedia, so the after-shot screen's own filter still runs through
// after-shot-export.ts. When the timeline hasn't done anything a remux could
// do, studio/export.ts returns the untouched blob, which keeps the common
// "opened it, trimmed a second, left" path at zero extra generations of
// compression. The editor itself is components/studio/StudioEditor.tsx.

function StudioRoute() {
  const { media } = useAfterShotContext();
  const [boot, setBoot] = useState<{ project: StudioProject; sources: SourceMap } | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // StrictMode mounts this twice in dev; probing the same blob twice would
    // create two sources and two object URLs for one clip.
    if (started.current) return;
    started.current = true;

    loadSource(media.blob, "original")
      .then((source) => setBoot(projectFrom([source])))
      .catch((err: unknown) => {
        setBootError(err instanceof Error ? err.message : "Could not open that clip");
      });
  }, [media.blob]);

  if (bootError) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-black px-8 text-white">
        <p className="text-center text-sm text-white/70">{bootError}</p>
        <BackLink />
      </div>
    );
  }

  if (!boot) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black text-white">
        <Loader2 className="animate-spin" size={22} />
      </div>
    );
  }

  return <AfterShotStudio project={boot.project} sources={boot.sources} />;
}

function AfterShotStudio({ project, sources }: { project: StudioProject; sources: SourceMap }) {
  const navigate = useNavigate();
  const { media, setMedia } = useAfterShotContext();
  const { layers, replaceLayers } = useAfterShotLayers();

  // Captions, stickers and drawings from the after-shot screen go into the
  // studio as timed layers and are baked by its export — not a second time
  // here. So the after-shot copy is emptied while the studio has them, and
  // put back if the studio is left without exporting: Back loses nothing.
  const [inherited] = useState<Layer[]>(() => layers);
  const exported = useRef(false);
  useEffect(() => {
    if (inherited.length === 0) return;
    replaceLayers([]);
    return () => {
      if (!exported.current) replaceLayers(inherited);
    };
  }, [inherited, replaceLayers]);

  const handleDone = useCallback(
    (result: StudioDone) => {
      exported.current = true;
      // Library sounds are inside the file now. The post carries their credit
      // with no bytes — `bakedIn` — or the feed would show a CC BY track with
      // nobody named. Otherwise the sound picked on the after-shot screen
      // survives the trip, unless the studio laid sound of its own: the feed
      // plays a post's sound INSTEAD of the video's, so keeping the old pick
      // would silence the mix just made. The cover is the studio's own pick
      // or none — the old one is a frame of the old cut.
      const { audio, ...rest } = media;
      const credit = combineCredits(result.credits);
      const sound = credit
        ? {
            audio: {
              blob: null,
              url: "",
              name: result.soundNames.join(" · ").slice(0, 100),
              credit,
              bakedIn: true,
            },
          }
        : audio && !result.hasOwnAudio
          ? { audio }
          : {};
      setMedia({
        ...rest,
        ...sound,
        type: "video",
        blob: result.blob,
        url: result.url,
        poster: result.poster,
      });
      navigate({ to: "/create/after-shot" });
    },
    [media, navigate, setMedia],
  );

  return (
    <StudioEditor
      initialProject={project}
      initialSources={sources}
      inheritedLayers={inherited}
      onDone={handleDone}
      onLeave={() => navigate({ to: "/create/after-shot" })}
    />
  );
}

function BackLink() {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate({ to: "/create/after-shot" })}
      className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-black"
    >
      Back
    </button>
  );
}
