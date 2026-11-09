import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { NO_EDITS, useAfterShotContext } from "@/lib/after-shot-context";
import { isNeutralAdjust, type PhotoAdjust } from "@/lib/photo-adjust";
import type { Adjustments } from "@/lib/studio/types";
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

/** The after-shot Adjust sliders in the studio's terms. Highlights and
 *  shadows have no studio equivalent and stay behind; everything else maps
 *  one to one. */
function toStudioAdjustments(a: PhotoAdjust): Adjustments {
  return {
    brightness: a.exposure,
    contrast: a.contrast,
    saturation: a.vibrance,
    warmth: a.temperature,
    fade: 0,
    vignette: a.vignette,
  };
}

/** Width / height of a local video or image blob URL. */
function probeAspect(url: string, type: "photo" | "video"): Promise<number | null> {
  return new Promise((resolve) => {
    if (type === "photo") {
      const img = new Image();
      img.onload = () => resolve(img.naturalWidth / img.naturalHeight);
      img.onerror = () => resolve(null);
      img.src = url;
      return;
    }
    const v = document.createElement("video");
    v.muted = true;
    v.preload = "metadata";
    v.onloadedmetadata = () => resolve(v.videoHeight ? v.videoWidth / v.videoHeight : null);
    v.onerror = () => resolve(null);
    v.src = url;
  });
}

function StudioRoute() {
  const { media, edits } = useAfterShotContext();
  const [boot, setBoot] = useState<{ project: StudioProject; sources: SourceMap } | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // StrictMode mounts this twice in dev; probing the same blob twice would
    // create two sources and two object URLs for one clip.
    if (started.current) return;
    started.current = true;

    // The after-shot filter and Adjust go in as the clip's grade, so the
    // studio draws them UNDER the captions it bakes. Left on the after-shot
    // side they would be applied over the studio's render — captions,
    // stickers and drawings included — tinting text the preview showed clean.
    const graded = edits.filterId !== NO_EDITS.filterId || !isNeutralAdjust(edits.adjust);
    loadSource(media.blob, "original")
      .then((source) => {
        const booted = projectFrom([source]);
        if (graded) {
          booted.project.clips = booted.project.clips.map((clip) => ({
            ...clip,
            filterId: edits.filterId,
            adjustments: toStudioAdjustments(edits.adjust),
          }));
        }
        setBoot(booted);
      })
      .catch((err: unknown) => {
        setBootError(err instanceof Error ? err.message : "Could not open that clip");
      });
    // The grade is read once, at boot: the studio clears it from the
    // after-shot side on mount, and re-booting on that change would reload
    // the clip without it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const { media, setMedia, edits, setEdits } = useAfterShotContext();
  const { layers, replaceLayers } = useAfterShotLayers();

  // The grade went into the studio's clips (see StudioRoute); same deal as the
  // layers below — emptied here while the studio has it, back on Back.
  const [inheritedGrade] = useState(() => ({
    filterId: edits.filterId,
    filterIntensity: edits.filterIntensity,
    adjust: edits.adjust,
  }));
  const [inheritedCrop] = useState(() => edits.cropRect);
  useEffect(() => {
    setEdits((e) => ({
      ...e,
      filterId: NO_EDITS.filterId,
      filterIntensity: NO_EDITS.filterIntensity,
      adjust: NO_EDITS.adjust,
    }));
    return () => {
      if (!exported.current) setEdits((e) => ({ ...e, ...inheritedGrade }));
    };
  }, [inheritedGrade, setEdits]);

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
      const previousUrl = media.url;
      const previousType = media.type;
      // Measured before setMedia, which revokes the old URL.
      // Not when the studio baked captions in: it placed them as fractions of
      // the FULL frame, and cropping that render afterwards could cut them.
      const sameShape =
        inheritedCrop && inherited.length === 0
          ? Promise.all([
              probeAspect(previousUrl, previousType),
              probeAspect(result.url, "video"),
            ]).then(([a, b]) => a !== null && b !== null && Math.abs(a / b - 1) < 0.01)
          : Promise.resolve(false);
      void sameShape.then((keep) => {
        setMedia({
          ...rest,
          ...sound,
          type: "video",
          blob: result.blob,
          url: result.url,
          poster: result.poster,
        });
        // setMedia drops the crop for a new file, since it was a fraction of a
        // frame that may no longer exist. When the studio kept the frame's
        // shape (trim, speed, sound), the fraction still means the same thing,
        // and silently losing a crop the seller set is the worse outcome.
        if (keep) setEdits((e) => ({ ...e, cropRect: inheritedCrop }));
        navigate({ to: "/create/after-shot" });
      });
    },
    [media, navigate, setMedia, setEdits, inheritedCrop, inherited],
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
