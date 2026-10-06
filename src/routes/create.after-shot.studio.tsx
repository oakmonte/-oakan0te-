import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  Loader2,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Redo2,
  Undo2,
  X,
} from "lucide-react";
import { useAfterShotContext } from "@/lib/after-shot-context";
import { useAfterShotLayers, type Layer } from "@/lib/after-shot-layers";
import { useLockedViewport } from "@/hooks/use-locked-viewport";
import StudioPreview from "@/components/studio/StudioPreview";
import StudioTimeline from "@/components/studio/StudioTimeline";
import { ClipToolbar, PrimaryToolbar } from "@/components/studio/StudioToolbar";
import type { ClipTool, PrimaryTool } from "@/components/studio/StudioToolbar";
import { useFilmstrips, useWaveforms } from "@/components/studio/use-timeline-media";
import {
  AudioClipPanel,
  ClipVolumePanel,
  SpeedPanel,
  TransitionPanel,
} from "@/components/studio/panels/ClipPanels";
import { AdjustPanel, FilterPanel } from "@/components/studio/panels/GradePanels";
import { SoundPanel } from "@/components/studio/panels/SoundPanel";
import { CanvasPanel, CoverPanel } from "@/components/studio/panels/CanvasPanel";
import { TextPanel } from "@/components/studio/panels/TextPanel";
import { PinPanel } from "@/components/studio/panels/PinPanel";
import { OverlayPanel } from "@/components/studio/panels/OverlayPanel";
import { useStudioProject } from "@/lib/studio/project";
import { usePlayback } from "@/lib/studio/use-playback";
import { exportCover, exportTimeline, outputSize, timelineFps } from "@/lib/studio/export";
import { cachedBeats, clearAudioCache, decodeSourceAudio, estimateBpm } from "@/lib/studio/audio";
import { clearFilmstripCache } from "@/lib/studio/filmstrip";
import {
  DEFAULT_IMAGE_DURATION,
  STUDIO_ACCEPT,
  STUDIO_AUDIO_ACCEPT,
  fileLabel,
  loadSource,
} from "@/lib/studio/sources";
import { TIMELINE_HEIGHT } from "@/lib/studio/layout";
import ConfirmDiscard from "@/components/editor/ConfirmDiscard";
import { HintBubble } from "@/components/editor/OneTimeHint";
import { useOneTimeHint } from "@/hooks/use-one-time-hint";
import {
  ASPECT_PRESETS,
  NEUTRAL_ADJUSTMENTS,
  NO_TRANSITION,
  TEXT_DEFAULTS,
  clipDuration,
  clipStarts,
  formatTimecode,
  projectDuration,
  resolveAtTime,
  uid,
  type Adjustments,
  type AudioClip,
  type FitMode,
  type ProductPin,
  type SourceMap,
  type StudioProject,
  type StudioSelection,
  type StudioSource,
  type TimedLayer,
  type TransitionKind,
  type VideoClip,
} from "@/lib/studio/types";

export const Route = createFileRoute("/create/after-shot/studio")({
  head: () => ({ meta: [{ title: "Studio — Oakmonte" }] }),
  component: StudioRoute,
});

// The multi-clip video editor. It replaces the old single-clip trim screen
// entirely, and it is the only place in the app where a post can be built from
// more than one take.
//
// It hands its result back to /create/after-shot as a normal CapturedMedia, the
// same way trimming used to — so the final composite (the after-shot screen's
// own filter and captions) still runs through after-shot-export.ts. When the
// timeline hasn't done anything a remux could do, studio/export.ts detects that
// and returns the untouched blob, which keeps the common "opened it, trimmed a
// second, left" path at zero extra generations of compression.

type PanelId =
  | "speed"
  | "volume"
  | "filters"
  | "adjust"
  | "transition"
  | "sound"
  | "text"
  | "overlay"
  | "tags"
  | "canvas"
  | "cover"
  | "audio";

function nearestAspectId(width: number, height: number): string {
  if (!width || !height) return ASPECT_PRESETS[0].id;
  const ratio = width / height;
  let best = ASPECT_PRESETS[0];
  for (const preset of ASPECT_PRESETS) {
    if (Math.abs(preset.ratio - ratio) < Math.abs(best.ratio - ratio)) best = preset;
  }
  return best.id;
}

function makeClip(source: StudioSource): VideoClip {
  return {
    id: uid("clip"),
    sourceId: source.id,
    inPoint: 0,
    outPoint: source.kind === "image" ? DEFAULT_IMAGE_DURATION : source.duration,
    speed: 1,
    volume: 1,
    muted: false,
    audioDetached: false,
    filterId: "natural",
    adjustments: { ...NEUTRAL_ADJUSTMENTS },
    transitionIn: NO_TRANSITION,
  };
}

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
      .then((source) => {
        setBoot({
          sources: { [source.id]: source },
          project: {
            clips: [makeClip(source)],
            audio: [],
            layers: [],
            pins: [],
            aspectId: nearestAspectId(source.width, source.height),
            fitMode: "fill",
            coverTime: 0,
            masterMuted: false,
          },
        });
      })
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

  return <StudioEditor initialProject={boot.project} initialSources={boot.sources} />;
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

function StudioEditor({
  initialProject,
  initialSources,
}: {
  initialProject: StudioProject;
  initialSources: SourceMap;
}) {
  useLockedViewport();
  const navigate = useNavigate();
  const { media, setMedia } = useAfterShotContext();
  const { layers: afterShotLayers, replaceLayers } = useAfterShotLayers();

  // Captions, stickers and drawings made on the after-shot screen come in as
  // ordinary timed layers spanning the whole video, so they're on the
  // timeline, can be trimmed to a stretch of it, and are baked by THIS export.
  // They used to sit over the preview as a read-only overlay and get baked a
  // second time back on the after-shot screen — a second encode of the whole
  // video, and the studio's cover was grabbed without them.
  //
  // The after-shot screen's copy is emptied while the studio has them and put
  // back if the studio is left without exporting; see the effect below.
  const [inherited] = useState<Layer[]>(() => afterShotLayers);
  const [startProject] = useState<StudioProject>(() => {
    if (inherited.length === 0) return initialProject;
    const end = Math.max(0.1, projectDuration(initialProject));
    const timed: TimedLayer[] = inherited.map((layer) => ({
      ...layer,
      startTime: 0,
      endTime: end,
    }));
    return { ...initialProject, layers: [...timed, ...initialProject.layers] };
  });
  const exportedRef = useRef(false);
  useEffect(() => {
    if (inherited.length === 0) return;
    replaceLayers([]);
    return () => {
      if (!exportedRef.current) replaceLayers(inherited);
    };
  }, [inherited, replaceLayers]);

  const { project, dispatch, undo, redo, canUndo, canRedo, beginHistoryGroup, endHistoryGroup } =
    useStudioProject(startProject);

  const [sources, setSources] = useState<SourceMap>(initialSources);
  const playback = usePlayback(project);
  const [selection, setSelection] = useState<StudioSelection>(null);
  const [panel, setPanel] = useState<PanelId | null>(null);
  const [filterPreviewId, setFilterPreviewId] = useState<string | null>(null);
  const [showGuides, setShowGuides] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const [beatSourceId, setBeatSourceId] = useState<string | null>(null);
  const [beatTimes, setBeatTimes] = useState<number[]>([]);
  const [bpm, setBpm] = useState<number | null>(null);
  const [detecting, setDetecting] = useState(false);

  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverBlob, setCoverBlob] = useState<Blob | null>(null);
  const [coverBusy, setCoverBusy] = useState(false);

  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Kept apart from `error`, which clears itself: a failed render is the one
  // message here that must still be on screen when the seller looks back, and
  // it comes with a way to try again.
  const [exportError, setExportError] = useState<string | null>(null);

  // "No beats inside this clip" is worth saying once, not worth parking over the
  // toolbar until something unrelated happens to clear it.
  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(null), 4000);
    return () => window.clearTimeout(timer);
  }, [error]);

  const clipInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const stickerInputRef = useRef<HTMLInputElement>(null);

  const filmstrips = useFilmstrips(sources);
  const waveforms = useWaveforms(sources);

  const duration = projectDuration(project);
  const starts = useMemo(() => clipStarts(project.clips), [project.clips]);

  // Sticker images picked inside the studio are object URLs this screen owns.
  // So are the after-shot's, once an export has baked them into the video —
  // nothing else will ever draw them again. If the studio is left without
  // exporting, those go back to the after-shot screen and stay alive.
  const stickerUrls = useRef<string[]>([]);

  // Every object URL the studio minted is revoked on the way out. The blob handed
  // back to the after-shot screen gets its own fresh URL, so this can't pull the
  // rug from under it.
  //
  // Deferred by a tick on purpose. StrictMode simulates a mount → unmount →
  // mount in dev, so a plain cleanup revokes these BETWEEN the two mounts and the
  // remounted editor is left pointing at dead blob URLs — every <video> stuck at
  // readyState 0 and the filmstrip empty. The remount re-runs this effect and
  // flips mounted back to true before the timeout fires; a real unmount doesn't.
  const sourcesRef = useRef(sources);
  sourcesRef.current = sources;
  const coverUrlRef = useRef<string | null>(null);
  coverUrlRef.current = coverUrl;
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    // The array itself, filled in as stickers are added; read at unmount.
    const minted = stickerUrls.current;
    return () => {
      mountedRef.current = false;
      const urls = Object.values(sourcesRef.current).map((s) => s.url);
      if (coverUrlRef.current) urls.push(coverUrlRef.current);
      setTimeout(() => {
        if (mountedRef.current) return;
        for (const url of urls) URL.revokeObjectURL(url);
        for (const url of minted) URL.revokeObjectURL(url);
        if (exportedRef.current) {
          for (const layer of inherited) {
            if (layer.kind === "sticker" && layer.assetUrl.startsWith("blob:")) {
              URL.revokeObjectURL(layer.assetUrl);
            }
          }
        }
        // These are module-level Maps, so they outlive the route unless someone
        // empties them. A decoded 60s stereo AudioBuffer is ~23MB and the
        // filmstrip holds dozens of base64 frames per source — enough, across a
        // few visits to the studio, to get the tab killed on a phone rather
        // than merely slowed down.
        clearAudioCache();
        clearFilmstripCache();
      }, 0);
    };
  }, [inherited]);

  // ---- selection helpers ---------------------------------------------------

  const selectedClip = useMemo(
    () =>
      selection?.kind === "clip"
        ? (project.clips.find((c) => c.id === selection.id) ?? null)
        : null,
    [selection, project.clips],
  );
  const selectedAudio = useMemo(
    () =>
      selection?.kind === "audio"
        ? (project.audio.find((a) => a.id === selection.id) ?? null)
        : null,
    [selection, project.audio],
  );
  const selectedLayer = useMemo(
    () =>
      selection?.kind === "layer"
        ? (project.layers.find((l) => l.id === selection.id) ?? null)
        : null,
    [selection, project.layers],
  );
  const selectedPin = useMemo(
    () =>
      selection?.kind === "pin" ? (project.pins.find((p) => p.id === selection.id) ?? null) : null,
    [selection, project.pins],
  );

  const clipAtPlayhead = resolveAtTime(project.clips, playback.time);
  const targetClip = selectedClip ?? clipAtPlayhead?.clip ?? null;
  const targetSource = targetClip ? sources[targetClip.sourceId] : undefined;
  const canDetach = Boolean(targetSource?.hasAudio) && !targetClip?.audioDetached;

  const layersRef = useRef(project.layers);
  layersRef.current = project.layers;
  const handleSelect = useCallback((next: StudioSelection) => {
    setSelection(next);
    if (!next) return setPanel(null);
    if (next.kind === "audio") setPanel("audio");
    else if (next.kind === "layer") {
      const layer = layersRef.current.find((l) => l.id === next.id);
      setPanel(layer && layer.kind !== "text" ? "overlay" : "text");
    } else if (next.kind === "pin") setPanel("tags");
    else setPanel(null);
  }, []);

  const group = useMemo(
    () => ({ begin: beginHistoryGroup, end: endHistoryGroup }),
    [beginHistoryGroup, endHistoryGroup],
  );

  // ---- timeline callbacks (stable — StudioTimeline is memoised) ------------

  const handleTrim = useCallback(
    (clipId: string, edge: "in" | "out", sourceTime: number) => {
      const clip = project.clips.find((c) => c.id === clipId);
      if (!clip) return;
      const source = sources[clip.sourceId];
      const limit = source ? source.duration : Infinity;
      if (edge === "in") {
        dispatch({ type: "trimClip", id: clipId, inPoint: Math.max(0, sourceTime), limit });
      } else {
        dispatch({ type: "trimClip", id: clipId, outPoint: sourceTime, limit });
      }
    },
    [dispatch, project.clips, sources],
  );

  const handleReorder = useCallback(
    (clipId: string, toIndex: number) => dispatch({ type: "reorderClip", id: clipId, toIndex }),
    [dispatch],
  );

  const handleCloseGap = useCallback(
    (clipId: string) => dispatch({ type: "closeGap", id: clipId }),
    [dispatch],
  );

  const handleMoveAudio = useCallback(
    (audioId: string, timelineStart: number, lane: number) =>
      dispatch({ type: "updateAudio", id: audioId, patch: { timelineStart, lane } }),
    [dispatch],
  );

  const handleRetimeOverlay = useCallback(
    (
      kind: "layer" | "pin",
      id: string,
      patch: { startTime?: number; endTime?: number; lane?: number },
    ) =>
      dispatch(
        kind === "layer" ? { type: "updateLayer", id, patch } : { type: "updatePin", id, patch },
      ),
    [dispatch],
  );

  const handleTrimAudio = useCallback(
    (audioId: string, edge: "in" | "out", sourceTime: number) => {
      const audio = project.audio.find((a) => a.id === audioId);
      if (!audio) return;
      const source = sources[audio.sourceId];
      const limit = source ? source.duration : Infinity;
      if (edge === "in") {
        const inPoint = Math.min(Math.max(0, sourceTime), audio.outPoint - 0.1);
        // Trimming the head of a floating clip must not slide the rest of it:
        // the sound that was under the playhead has to stay under the playhead.
        dispatch({
          type: "updateAudio",
          id: audioId,
          patch: {
            inPoint,
            timelineStart: audio.timelineStart + (inPoint - audio.inPoint) / audio.speed,
          },
        });
      } else {
        dispatch({
          type: "updateAudio",
          id: audioId,
          patch: { outPoint: Math.max(audio.inPoint + 0.1, Math.min(limit, sourceTime)) },
        });
      }
    },
    [dispatch, project.audio, sources],
  );

  // What the bake will actually produce. Cheap enough to derive on render, and
  // only read while the export overlay is up.
  const outputSpec = useMemo(
    () => ({ ...outputSize(project, sources), fps: timelineFps(project, sources) }),
    [project, sources],
  );

  const handleAddClips = useCallback(() => clipInputRef.current?.click(), []);
  const handleAddMusic = useCallback(() => audioInputRef.current?.click(), []);

  const handleToggleMasterMute = useCallback(
    () => dispatch({ type: "toggleMasterMute" }),
    [dispatch],
  );

  const handleOpenTransition = useCallback((clipId: string) => {
    setSelection({ kind: "clip", id: clipId });
    setPanel("transition");
  }, []);

  /** Gallery pictures dropped on the frame from the playhead to the end of
   *  the video, each on a free sticker lane. Slightly above centre so it
   *  doesn't land exactly on a caption. */
  const handleStickerFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      const end = Math.max(0.1, projectDuration(project));
      const now = playback.timeRef.current;
      // From the start when the playhead is parked at (or near) the end, or
      // the sticker would be a sliver nobody can see.
      const start = now > end - 0.5 ? 0 : now;
      let lastId: string | null = null;
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        const url = URL.createObjectURL(file);
        stickerUrls.current.push(url);
        const layer: TimedLayer = {
          id: uid("layer"),
          kind: "sticker",
          assetUrl: url,
          x: 0.5,
          y: 0.42,
          scale: 1,
          rotation: 0,
          zIndex: 0,
          startTime: start,
          endTime: end,
        };
        dispatch({ type: "addLayer", layer });
        lastId = layer.id;
      }
      if (lastId) {
        setSelection({ kind: "layer", id: lastId });
        setPanel("overlay");
      }
    },
    [dispatch, playback.timeRef, project],
  );

  const handleUpdateLayer = useCallback(
    (id: string, patch: Partial<TimedLayer>) => dispatch({ type: "updateLayer", id, patch }),
    [dispatch],
  );

  const handleUpdatePin = useCallback(
    (id: string, patch: Partial<ProductPin>) => dispatch({ type: "updatePin", id, patch }),
    [dispatch],
  );

  // ---- gallery ------------------------------------------------------------

  const ingest = useCallback(
    async (files: FileList | null, as: "clip" | "audio") => {
      if (!files || files.length === 0) return;
      setError(null);
      const added: StudioSource[] = [];
      const clips: VideoClip[] = [];
      const audioClips: AudioClip[] = [];
      const timelineEnd = projectDuration(project);

      for (const file of Array.from(files)) {
        try {
          const source = await loadSource(file, fileLabel(file));
          added.push(source);
          if (as === "clip" && source.kind !== "audio") {
            clips.push(makeClip(source));
          } else if (source.hasAudio) {
            audioClips.push({
              id: uid("audio"),
              sourceId: source.id,
              kind: "music",
              label: source.name,
              // Dropped at the playhead, which is where you were looking — not at
              // zero, which is almost never where you want a track to start.
              timelineStart: Math.min(playback.timeRef.current, timelineEnd),
              inPoint: 0,
              outPoint: source.duration,
              speed: 1,
              volume: 0.8,
              muted: false,
              fadeIn: 0.15,
              fadeOut: 0.4,
            });
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : `Could not add ${file.name}`);
        }
      }

      if (added.length === 0) return;
      setSources((prev) => {
        const next = { ...prev };
        for (const source of added) next[source.id] = source;
        return next;
      });
      if (clips.length) dispatch({ type: "addClips", clips });
      for (const audio of audioClips) dispatch({ type: "addAudio", clip: audio });
    },
    [dispatch, playback.timeRef, project],
  );

  // ---- beats --------------------------------------------------------------

  const detectBeats = useCallback(async () => {
    // Prefer a real music track; fall back to whatever the clip under the
    // playhead is carrying.
    const candidate =
      project.audio.map((a) => sources[a.sourceId]).find((s) => s?.hasAudio) ??
      (targetSource?.hasAudio ? targetSource : undefined);
    if (!candidate) {
      setError("Nothing with sound to analyse yet");
      return;
    }
    setDetecting(true);
    setError(null);
    try {
      const buffer = await decodeSourceAudio(candidate);
      if (!buffer) {
        setError("Could not read that audio");
        return;
      }
      const found = cachedBeats(candidate.id, buffer);
      setBeatSourceId(candidate.id);
      setBeatTimes(found);
      setBpm(estimateBpm(found));
    } finally {
      setDetecting(false);
    }
  }, [project.audio, sources, targetSource]);

  /** Beat positions live in SOURCE time; the markers and the auto-cut need them
   *  in timeline time, which depends on where every clip using that source sits
   *  and how fast it is running. */
  const beatsOnTimeline = useMemo(() => {
    if (!beatSourceId || beatTimes.length === 0) return [];
    const out: number[] = [];
    project.clips.forEach((clip, index) => {
      if (clip.sourceId !== beatSourceId || clip.audioDetached) return;
      for (const t of beatTimes) {
        if (t < clip.inPoint || t > clip.outPoint) continue;
        out.push(starts[index] + (t - clip.inPoint) / clip.speed);
      }
    });
    for (const audio of project.audio) {
      if (audio.sourceId !== beatSourceId) continue;
      for (const t of beatTimes) {
        if (t < audio.inPoint || t > audio.outPoint) continue;
        out.push(audio.timelineStart + (t - audio.inPoint) / audio.speed);
      }
    }
    return out.sort((a, b) => a - b);
  }, [beatSourceId, beatTimes, project.clips, project.audio, starts]);

  const cutToBeats = useCallback(() => {
    const at = resolveAtTime(project.clips, playback.timeRef.current);
    if (!at) return;
    const inside = beatsOnTimeline.filter((t) => t > at.start + 0.15 && t < at.end - 0.15);
    if (inside.length === 0) {
      setError("No beats inside this clip");
      return;
    }
    // One undo step for the whole run — a dozen separate splits would take a
    // dozen taps to walk back.
    beginHistoryGroup();
    for (const t of inside) dispatch({ type: "splitAt", time: t });
    endHistoryGroup();
  }, [
    beatsOnTimeline,
    beginHistoryGroup,
    dispatch,
    endHistoryGroup,
    project.clips,
    playback.timeRef,
  ]);

  // ---- cover --------------------------------------------------------------

  const pickCover = useCallback(async () => {
    setCoverBusy(true);
    setError(null);
    try {
      const time = playback.timeRef.current;
      const blob = await exportCover(project, sources, time);
      setCoverBlob(blob);
      setCoverUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
      dispatch({ type: "setCoverTime", time });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not grab that frame");
    } finally {
      setCoverBusy(false);
    }
  }, [dispatch, playback.timeRef, project, sources]);

  // ---- export -------------------------------------------------------------

  const handleExport = useCallback(async () => {
    playback.pause();
    setExporting(true);
    setProgress(0);
    setError(null);
    setExportError(null);
    try {
      const blob = await exportTimeline(project, sources, setProgress);
      const url = URL.createObjectURL(blob);
      const poster = coverBlob
        ? { blob: coverBlob, url: URL.createObjectURL(coverBlob) }
        : undefined;
      // Spread so the sound picked on the after-shot screen survives the trip;
      // it was dropped here, and the post went out silent. Unless the studio
      // laid its own music: the feed plays a post's sound INSTEAD of the
      // video's, so keeping the old pick would silence the mix just made.
      // The cover is the studio's own pick or none — the old one is a frame
      // of the old cut.
      const { audio, ...rest } = media;
      setMedia({
        ...rest,
        ...(audio && project.audio.length === 0 ? { audio } : {}),
        type: "video",
        blob,
        url,
        poster,
      });
      exportedRef.current = true;
      navigate({ to: "/create/after-shot" });
    } catch (err) {
      console.error("Studio export failed:", err);
      setExportError("Couldn't make your video.");
    } finally {
      setExporting(false);
    }
  }, [coverBlob, media, navigate, playback, project, setMedia, sources]);

  // Leaving throws the whole edit away: the project is in memory only, so a
  // mis-tapped chevron on a six-clip cut is unrecoverable. Anything more than
  // the clip you walked in with earns a confirmation.
  const [confirmBack, setConfirmBack] = useState(false);
  const hasWork =
    project.clips.length > 1 ||
    project.audio.length > 0 ||
    project.layers.length > inherited.length ||
    project.pins.length > 0 ||
    canUndo;

  // The two timeline gestures nothing on screen shows. Waits for a second clip,
  // because that is the first moment either of them is worth knowing.
  const [gestureHint, dismissGestureHint] = useOneTimeHint(
    "studio-timeline-gestures",
    project.clips.length > 1,
  );

  const handleBack = useCallback(() => {
    playback.pause();
    if (hasWork) setConfirmBack(true);
    else navigate({ to: "/create/after-shot" });
  }, [hasWork, navigate, playback]);

  // ---- toolbar routing ----------------------------------------------------

  const handlePrimary = useCallback(
    (tool: PrimaryTool) => {
      if (tool === "sticker") {
        stickerInputRef.current?.click();
        return;
      }
      if (tool === "edit") {
        // The clip under the playhead — or, when the playhead is parked in a
        // gap, the nearest one. Doing nothing there left Edit looking broken.
        const now = playback.timeRef.current;
        const at = resolveAtTime(project.clips, now);
        let clip = at?.clip ?? null;
        if (!clip && project.clips.length > 0) {
          let best = Infinity;
          project.clips.forEach((c, i) => {
            const start = starts[i];
            const end = start + clipDuration(c);
            const distance = now < start ? start - now : Math.max(0, now - end);
            if (distance < best) {
              best = distance;
              clip = c;
            }
          });
        }
        if (clip) setSelection({ kind: "clip", id: clip.id });
        setPanel(null);
        return;
      }
      if (tool === "text") setSelection(null);
      if (tool === "tags") setSelection(null);
      setPanel(tool === "sound" ? "sound" : tool);
    },
    [playback.timeRef, project.clips, starts],
  );

  const handleClipTool = useCallback(
    (tool: ClipTool) => {
      const clip = selectedClip;
      if (!clip) return;
      switch (tool) {
        case "split":
          dispatch({ type: "splitAt", time: playback.timeRef.current });
          break;
        case "separate":
          dispatch({ type: "detachAudio", id: clip.id });
          break;
        case "moveLeft":
          dispatch({ type: "moveClip", id: clip.id, delta: -1 });
          break;
        case "moveRight":
          dispatch({ type: "moveClip", id: clip.id, delta: 1 });
          break;
        case "duplicate":
          dispatch({ type: "duplicateClip", id: clip.id });
          break;
        case "delete":
          dispatch({ type: "deleteClip", id: clip.id });
          setSelection(null);
          break;
        default: {
          // Grading a clip you cannot see is guesswork, so step into it first.
          // Selecting doesn't move the playhead (that would fight scrubbing),
          // but opening a panel scoped to one clip has to put it on screen.
          const index = project.clips.findIndex((c) => c.id === clip.id);
          if (index >= 0) {
            const start = starts[index];
            const end = start + clipDuration(clip);
            const now = playback.timeRef.current;
            if (now < start || now >= end) playback.seek(start + Math.min(0.05, (end - start) / 2));
          }
          setPanel(tool);
        }
      }
    },
    [dispatch, playback, project.clips, selectedClip, starts],
  );

  // ---- render -------------------------------------------------------------

  const bottom = () => {
    if (panel === "speed") {
      return (
        <SpeedPanel
          clip={targetClip}
          group={group}
          onSpeed={(speed) =>
            targetClip && dispatch({ type: "setSpeed", id: targetClip.id, speed })
          }
          onRevealRamp={() => dispatch({ type: "revealRamp", time: playback.timeRef.current })}
          onDone={() => setPanel(null)}
        />
      );
    }
    if (panel === "volume") {
      return (
        <ClipVolumePanel
          clip={targetClip}
          group={group}
          canDetach={Boolean(targetSource?.hasAudio)}
          onVolume={(volume) =>
            targetClip && dispatch({ type: "setVolume", id: targetClip.id, volume })
          }
          onToggleMute={() => targetClip && dispatch({ type: "toggleClipMute", id: targetClip.id })}
          onDetach={() => targetClip && dispatch({ type: "detachAudio", id: targetClip.id })}
          onDone={() => setPanel(null)}
        />
      );
    }
    if (panel === "audio" && selectedAudio) {
      return (
        <AudioClipPanel
          audio={selectedAudio}
          group={group}
          onPatch={(patch) => dispatch({ type: "updateAudio", id: selectedAudio.id, patch })}
          onDelete={() => {
            dispatch({ type: "deleteAudio", id: selectedAudio.id });
            setSelection(null);
            setPanel(null);
          }}
          onReattach={() => {
            dispatch({ type: "reattachAudio", audioId: selectedAudio.id });
            setSelection(null);
            setPanel(null);
          }}
          onDone={() => setPanel(null)}
        />
      );
    }
    if (panel === "filters") {
      return (
        <FilterPanel
          clip={targetClip}
          onPick={(filterId) =>
            targetClip && dispatch({ type: "setFilter", id: targetClip.id, filterId })
          }
          onPreview={setFilterPreviewId}
          onApplyAll={(filterId) => dispatch({ type: "setFilter", id: "", filterId, all: true })}
          onDone={() => setPanel(null)}
        />
      );
    }
    if (panel === "adjust") {
      return (
        <AdjustPanel
          clip={targetClip}
          group={group}
          onChange={(adjustments: Adjustments) =>
            targetClip && dispatch({ type: "setAdjustments", id: targetClip.id, adjustments })
          }
          onApplyAll={(adjustments) =>
            dispatch({ type: "setAdjustments", id: "", adjustments, all: true })
          }
          onDone={() => setPanel(null)}
        />
      );
    }
    if (panel === "transition") {
      return (
        <TransitionPanel
          clip={selectedClip}
          group={group}
          onSet={(kind, transitionDuration) =>
            selectedClip &&
            dispatch({
              type: "setTransition",
              id: selectedClip.id,
              transition: { kind: kind as TransitionKind, duration: transitionDuration },
            })
          }
          onDone={() => setPanel(null)}
        />
      );
    }
    if (panel === "sound") {
      return (
        <SoundPanel
          clip={targetClip}
          canDetach={canDetach}
          onAddMusic={handleAddMusic}
          onDetach={() => targetClip && dispatch({ type: "detachAudio", id: targetClip.id })}
          onDetectBeats={detectBeats}
          onCutToBeats={cutToBeats}
          beatCount={beatsOnTimeline.length}
          bpm={bpm}
          detecting={detecting}
          onDone={() => setPanel(null)}
        />
      );
    }
    if (panel === "overlay") {
      return (
        <OverlayPanel
          layer={selectedLayer}
          currentTime={playback.time}
          onPatch={(patch) => selectedLayer && handleUpdateLayer(selectedLayer.id, patch)}
          onDelete={() => {
            if (!selectedLayer) return;
            dispatch({ type: "deleteLayer", id: selectedLayer.id });
            setSelection(null);
            setPanel(null);
          }}
          onDone={() => setPanel(null)}
        />
      );
    }
    if (panel === "text") {
      return (
        <TextPanel
          layer={selectedLayer}
          duration={duration}
          currentTime={playback.time}
          group={group}
          onAdd={(content) => {
            const start = playback.timeRef.current;
            const layer: TimedLayer = {
              ...TEXT_DEFAULTS,
              id: uid("layer"),
              kind: "text",
              content,
              startTime: start,
              endTime: Math.min(duration, start + 2.5),
            };
            dispatch({ type: "addLayer", layer });
            setSelection({ kind: "layer", id: layer.id });
          }}
          onPatch={(patch) => selectedLayer && handleUpdateLayer(selectedLayer.id, patch)}
          onDelete={() => {
            if (!selectedLayer) return;
            dispatch({ type: "deleteLayer", id: selectedLayer.id });
            setSelection(null);
          }}
          onDone={() => setPanel(null)}
        />
      );
    }
    if (panel === "tags") {
      return (
        <PinPanel
          pin={selectedPin}
          duration={duration}
          currentTime={playback.time}
          group={group}
          onAdd={(title, price) => {
            const start = playback.timeRef.current;
            const pin: ProductPin = {
              id: uid("pin"),
              title,
              price,
              x: 0.32,
              y: 0.52,
              startTime: start,
              endTime: Math.min(duration, start + 3),
              side: "right",
            };
            dispatch({ type: "addPin", pin });
            setSelection({ kind: "pin", id: pin.id });
          }}
          onPatch={(patch) => selectedPin && handleUpdatePin(selectedPin.id, patch)}
          onDelete={() => {
            if (!selectedPin) return;
            dispatch({ type: "deletePin", id: selectedPin.id });
            setSelection(null);
          }}
          onDone={() => setPanel(null)}
        />
      );
    }
    if (panel === "canvas") {
      return (
        <CanvasPanel
          project={project}
          onAspect={(aspectId) => dispatch({ type: "setAspect", aspectId })}
          onFitMode={(fitMode: FitMode) => dispatch({ type: "setFitMode", fitMode })}
          showGuides={showGuides}
          onToggleGuides={() => setShowGuides((v) => !v)}
          onDone={() => setPanel(null)}
        />
      );
    }
    if (panel === "cover") {
      return (
        <CoverPanel
          coverTime={project.coverTime}
          currentTime={playback.time}
          coverUrl={coverUrl}
          busy={coverBusy}
          onPick={pickCover}
          onDone={() => setPanel(null)}
        />
      );
    }
    if (selection?.kind === "clip") {
      return (
        <ClipToolbar
          onPick={handleClipTool}
          onDone={() => setSelection(null)}
          canDetach={canDetach}
          canDelete={project.clips.length > 1}
          isFirstClip={project.clips[0]?.id === selection.id}
          canMoveLeft={project.clips.findIndex((c) => c.id === selection.id) > 0}
          canMoveRight={
            project.clips.findIndex((c) => c.id === selection.id) < project.clips.length - 1
          }
        />
      );
    }
    return <PrimaryToolbar onPick={handlePrimary} />;
  };

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden bg-black text-white"
      style={{ fontFamily: "'SF Pro', system-ui, sans-serif" }}
    >
      <header
        className="flex shrink-0 items-center justify-between px-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 10px)", paddingBottom: 8 }}
      >
        <button
          onClick={handleBack}
          aria-label="Back"
          className="flex h-11 w-11 items-center justify-center rounded-full transition-transform active:scale-90"
          style={{ background: "rgba(255,255,255,0.10)" }}
        >
          <ChevronLeft size={20} />
        </button>

        <span className="text-[15px] font-semibold">Edit clips</span>

        {/* Says what it does. It was a bare red arrow, which read as "next
            step" — it renders the cut and hands it back to the editor you
            came from. */}
        <button
          onClick={handleExport}
          disabled={exporting}
          aria-label="Done editing clips"
          className="flex h-11 items-center justify-center gap-1.5 rounded-full bg-[var(--oak-action)] px-4 text-[13px] font-semibold transition-transform active:scale-90 disabled:opacity-60"
        >
          {exporting ? <Loader2 size={18} className="animate-spin" /> : <span>Done</span>}
        </button>
      </header>

      <StudioPreview
        project={project}
        sources={sources}
        playback={playback}
        selection={selection}
        onSelect={handleSelect}
        onUpdateLayer={handleUpdateLayer}
        onUpdatePin={handleUpdatePin}
        showGuides={showGuides}
        filterPreviewId={filterPreviewId}
        gradeClipId={targetClip?.id ?? null}
      />

      {/* Transport row — timecode, play, history, fullscreen. */}
      <div className="flex shrink-0 items-center px-2 py-0.5">
        <span className="w-[132px] text-[12px] tabular-nums text-white/65">
          <span className="text-white">{formatTimecode(playback.time)}</span>
          <span className="text-white/60">/{formatTimecode(duration)}</span>
        </span>

        <div className="flex flex-1 justify-center">
          <button
            onClick={playback.toggle}
            aria-label={playback.playing ? "Pause" : "Play"}
            className="flex h-11 w-11 items-center justify-center active:scale-90"
          >
            {playback.playing ? <Pause size={20} fill="#fff" /> : <Play size={20} fill="#fff" />}
          </button>
        </div>

        {/* Each a full 44px square, side by side with no gap: at 18px glyphs
            12px apart, a thumb meant for Undo landed on Redo. */}
        <div className="flex w-[132px] items-center justify-end">
          <button
            onClick={undo}
            disabled={!canUndo}
            aria-label="Undo"
            className="flex h-11 w-11 items-center justify-center active:scale-90 disabled:opacity-25"
          >
            <Undo2 size={18} />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            aria-label="Redo"
            className="flex h-11 w-11 items-center justify-center active:scale-90 disabled:opacity-25"
          >
            <Redo2 size={18} />
          </button>
          <button
            onClick={() => setFullscreen((v) => !v)}
            aria-label={fullscreen ? "Exit full screen" : "Full screen"}
            className="flex h-11 w-11 items-center justify-center active:scale-90"
          >
            {fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </div>

      {!fullscreen && (
        <div className="shrink-0" style={{ minHeight: TIMELINE_HEIGHT }}>
          <StudioTimeline
            project={project}
            sources={sources}
            timeRef={playback.timeRef}
            subscribe={playback.subscribe}
            seek={playback.seek}
            pause={playback.pause}
            selection={selection}
            onSelect={handleSelect}
            filmstrips={filmstrips}
            waveforms={waveforms}
            beats={beatsOnTimeline}
            onTrim={handleTrim}
            onReorder={handleReorder}
            onCloseGap={handleCloseGap}
            onMoveAudio={handleMoveAudio}
            onRetimeOverlay={handleRetimeOverlay}
            onTrimAudio={handleTrimAudio}
            onAddClips={handleAddClips}
            onToggleMasterMute={handleToggleMasterMute}
            onOpenTransition={handleOpenTransition}
            beginHistoryGroup={beginHistoryGroup}
            endHistoryGroup={endHistoryGroup}
          />
        </div>
      )}

      {!fullscreen && (
        <div
          className="shrink-0"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 4px)" }}
        >
          {bottom()}
        </div>
      )}

      {error && (
        <div
          role="status"
          className="pointer-events-none absolute inset-x-6 bottom-28 rounded-xl bg-black/85 px-4 py-3"
        >
          <p className="text-center text-[13px] text-red-300">{error}</p>
        </div>
      )}

      {gestureHint && (
        <div
          className="pointer-events-none absolute inset-x-0 z-30 flex justify-center px-4"
          style={{ top: "calc(env(safe-area-inset-top) + 64px)" }}
        >
          <HintBubble onDismiss={dismissGestureHint}>
            Hold a clip to move it. Tap one to edit it. Pinch the timeline to zoom.
          </HintBubble>
        </div>
      )}

      {exportError && !exporting && (
        <div
          role="alert"
          className="absolute inset-x-4 bottom-28 z-40 flex items-center gap-3 rounded-xl bg-black/90 py-2 pl-4 pr-2"
        >
          <p className="min-w-0 flex-1 text-[13px] text-red-300">{exportError}</p>
          <button
            onClick={() => void handleExport()}
            className="h-9 shrink-0 rounded-full bg-white px-4 text-[13px] font-semibold text-black active:scale-95"
          >
            Try again
          </button>
          <button
            onClick={() => setExportError(null)}
            aria-label="Dismiss"
            className="oak-hit flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/70 active:scale-90"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {confirmBack && (
        <ConfirmDiscard
          message="Discard these clip edits? They aren't saved anywhere."
          onKeep={() => setConfirmBack(false)}
          onDiscard={() => navigate({ to: "/create/after-shot" })}
        />
      )}

      {exporting && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/80">
          <span className="text-[12px] uppercase tracking-widest">
            Making your video… {Math.round(progress * 100)}%
          </span>
          <div className="h-1 w-44 overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full bg-white transition-[width] duration-150"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          {/* Both numbers are measured from the footage rather than fixed, and a
              seller who shot at 60 has no other way to know they kept it. */}
          <span className="text-[12px] tabular-nums text-white/60">
            {outputSpec.width}×{outputSpec.height} · {outputSpec.fps}fps
          </span>
        </div>
      )}

      <input
        ref={clipInputRef}
        type="file"
        accept={STUDIO_ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => {
          void ingest(e.target.files, "clip");
          e.target.value = "";
        }}
      />
      {/* Several at once, like the after-shot picker: three stickers shouldn't
          mean opening the gallery three times. */}
      <input
        ref={stickerInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          handleStickerFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={audioInputRef}
        type="file"
        accept={STUDIO_AUDIO_ACCEPT}
        className="hidden"
        onChange={(e) => {
          void ingest(e.target.files, "audio");
          e.target.value = "";
        }}
      />
    </div>
  );
}
