import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Captions as CaptionsIcon,
  ChevronLeft,
  Copy,
  Layers2,
  Maximize2,
  Minimize2,
  Music,
  Pause,
  Play,
  Ratio,
  Redo2,
  Scissors,
  SlidersHorizontal,
  Sparkles,
  Sticker,
  Trash2,
  Type,
  Undo2,
  Wand2,
} from "lucide-react";
import {
  AfterShotLayersContext,
  useAfterShotLayers,
  useAfterShotLayersState,
} from "@/lib/after-shot-layers";
import type { Layer } from "@/lib/after-shot-layers";
import TextPanel from "@/components/camera/aftershot/TextPanel";
import FilterPanel from "@/components/camera/FilterPanel";
import PhotoAdjustPanel from "@/components/create/PhotoAdjustPanel";
import LayerOverlay from "@/components/camera/LayerOverlay";
import { useLayerRenderer } from "@/components/camera/aftershot/use-layer-renderer";
import { CAMERA_FILTERS, previewCssAtIntensity } from "@/components/camera/filter-data";
import { useLockedViewport } from "@/hooks/use-locked-viewport";
import { useFittedSize } from "@/hooks/use-fitted-size";
import { adjustToCss, NEUTRAL_ADJUST } from "@/lib/photo-adjust";
import { ImageSourceSheet, type ImageSource } from "@/components/product-form/ImageSourceSheet";
import { DraftImagePickerSheet } from "@/components/product-form/DraftImagePickerSheet";
import { PostImagePickerSheet } from "@/components/product-form/PostImagePickerSheet";
import type { PickedMedia } from "@/components/product-form/MediaPickerSheet";
import {
  discardVideoEditorSession,
  parkVideoEditorSession,
  takeVideoEditorSession,
} from "@/lib/video-editor-session";
import { setPendingCapture } from "@/lib/capture-handoff";
import VideoTimeline from "@/components/create/VideoTimeline";
import {
  ClipSheet,
  ComingSoonSheet,
  RatioSheet,
  TransitionSheet,
  SoundSheet,
} from "@/components/create/ClipOptionSheets";
import { exportSequence } from "@/lib/video-sequence-export";
import {
  blankClipEdits,
  clipDuration,
  clipStarts,
  extractFilmstrip,
  formatTime,
  locate,
  moveClip,
  newClipId,
  ratioValue,
  sequenceDuration,
  splitClip,
  videoDuration,
  videoThumbnail,
  type Clip,
  type ProjectRatio,
} from "@/lib/video-sequence";

export const Route = createFileRoute("/create/video-editor")({
  head: () => ({ meta: [{ title: "New video — Oakmonte" }] }),
  component: VideoEditorRoute,
});

// The video editor, reached from CREATE → New video.
//
// The difference from the photo editor next door is the whole reason this
// screen exists: that one produces a carousel, where each image stays its own
// slide. This one produces ONE video. Photos and clips go onto a single
// timeline, a photo simply being a clip that holds still, and everything on
// that timeline is welded into a single MP4 at export.
//
// Panels are reused wholesale from after-shot — TextPanel, FilterPanel,
// LayerOverlay, the layer renderer — because "put a caption on a frame" should
// not have three implementations that drift apart. What is NOT reused is
// after-shot-context, which carries exactly one CapturedMedia.
//
// Honest about what's decoration: Effects, Magic, Captions, Overlay and
// transitions are drawn and open a sheet that says they aren't wired yet.
// Everything else on this screen does what it looks like it does — Sound
// included, which takes an audio file off the device and mixes it under the
// whole timeline.

type ToolId =
  "clip" | "text" | "sticker" | "filter" | "adjust" | "ratio" | "transition" | "sound" | "soon";

type SoonInfo = { title: string; body: string };

const SOON: Record<string, SoonInfo> = {
  effects: {
    title: "Effects",
    body: "Timed visual effects sit on the timeline like clips do. The filter and tone tools next to this one are live today and apply per clip.",
  },
  magic: {
    title: "Magic",
    body: "Auto-cut to the beat, auto-framing and background removal. Each needs analysis passes that don't exist yet.",
  },
  captions: {
    title: "Captions",
    body: "Automatic captions need speech recognition on the audio track. Text added by hand works today — it's the Text tool.",
  },
  overlay: {
    title: "Overlay",
    body: "A second layer of video on top of the timeline. The exporter composites one clip at a time right now; overlays mean two decoders at once.",
  },
};

/** Snapshot of everything undo/redo restores. Deliberately just the timeline:
 *  text and sticker layers have their own selection and editing affordances,
 *  and folding them in here would make an undo mid-caption mean two different
 *  things depending on which panel was open. */
type Snapshot = { clips: Clip[]; ratio: ProjectRatio };

function VideoEditorRoute() {
  const layerState = useAfterShotLayersState();
  return (
    <AfterShotLayersContext.Provider value={layerState}>
      <VideoEditor />
    </AfterShotLayersContext.Provider>
  );
}

function VideoEditor() {
  useLockedViewport();
  const navigate = useNavigate();
  const { layers, addLayer, updateLayer, replaceLayers, selectedLayerId, setSelectedLayerId } =
    useAfterShotLayers();

  // Claimed once per mount, and BEFORE the state below is initialised — the
  // timeline you left behind is on screen from the first render rather than
  // appearing a frame after an empty one.
  const [session] = useState(takeVideoEditorSession);

  const [clips, setClips] = useState<Clip[]>(() => session?.clips ?? []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ratio, setRatio] = useState<ProjectRatio>(() => session?.ratio ?? "9:16");
  const [time, setTime] = useState(() => session?.time ?? 0);
  const [playing, setPlaying] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const [activeTool, setActiveTool] = useState<ToolId | null>(null);
  const [soon, setSoon] = useState<SoonInfo | null>(null);
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [previewFilterId, setPreviewFilterId] = useState<string | null>(null);
  const [previewFilterIntensity, setPreviewFilterIntensity] = useState<number | null>(null);
  const [favoritedFilterIds, setFavoritedFilterIds] = useState<Set<string>>(new Set());

  const [sourceOpen, setSourceOpen] = useState(false);
  const [sourceAnchor, setSourceAnchor] = useState<DOMRect | null>(null);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [postsOpen, setPostsOpen] = useState(false);
  // Music laid over the whole timeline. Session-lived like the clips are, and
  // parked with them so it survives the trip to publish.
  const [music, setMusic] = useState<{ file: File; name: string; volume: number } | null>(
    () => session?.music ?? null,
  );
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stickerInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const renderLayerContent = useLayerRenderer(frameRef);

  // One layer stack per clip. The shared layer context holds one at a time, so
  // changing selection parks the outgoing stack and hands over the incoming
  // one — same arrangement as the photo editor's carousel.
  const layersByClip = useRef<Record<string, Layer[]>>(session?.layersByClip ?? {});
  const ownedUrls = useRef<string[]>(session?.ownedUrls ?? []);

  // Leaving parks the edit rather than destroying it. Ownership of the object
  // URLs goes with it, and video-editor-session.ts is then the ONLY place they
  // are freed — via discardVideoEditorSession, which the Back button and a
  // sent post both call.
  //
  // The obvious alternative, revoking here on unmount, was tried and is wrong
  // in a way that only shows up when it runs: StrictMode mounts, unmounts and
  // remounts every component in dev, so the cleanup fired once on a component
  // that was about to come straight back — and every clip returned from
  // publish as a dead blob URL, "Format error", black preview. The after-shot
  // layout carries a note about the same trap for the same reason.
  //
  // A ref, because a cleanup with an empty dep list closes over the state as
  // it was on first render — which for a restored session is right, and for a
  // fresh one is an empty timeline.
  const latest = useRef({ clips, ratio, time, layers, music, currentId: null as string | null });

  const total = sequenceDuration(clips);
  const head = locate(clips, time);
  const current = head ? clips[head.index] : null;
  const selected = clips.find((c) => c.id === selectedId) ?? null;

  latest.current = { clips, ratio, time, layers, music, currentId: current?.id ?? null };
  // Read by the filmstrip queue to know whether a clip it is still decoding
  // for is one the user has since deleted.
  const liveClipIds = useRef(new Set<string>());
  liveClipIds.current = new Set(clips.map((c) => c.id));
  useEffect(
    () => () => {
      const { clips: c, ratio: r, time: t, layers: l, music: m, currentId } = latest.current;
      if (c.length === 0) return;
      // The live stack belongs to whichever clip was on screen; park it or the
      // caption you could see would not come back with it.
      if (currentId) layersByClip.current[currentId] = l;
      parkVideoEditorSession({
        clips: c,
        layersByClip: layersByClip.current,
        ratio: r,
        time: t,
        music: m,
        ownedUrls: ownedUrls.current,
      });
    },
    [],
  );
  const empty = clips.length === 0;

  /* ---------------- undo / redo ---------------- */

  // History is state, not refs, because the Undo and Redo buttons are disabled
  // off its emptiness — a ref would go stale in the header while the stack
  // underneath it filled up.
  const [past, setPast] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);

  /** Snapshot the CURRENT timeline, then apply the next one. Everything that
   *  changes the timeline in one discrete step goes through here. */
  const push = useCallback(() => {
    setPast((prev) => [...prev, { clips, ratio }].slice(-40));
    setFuture([]);
  }, [clips, ratio]);

  const commit = useCallback(
    (next: Clip[]) => {
      push();
      setClips(next);
    },
    [push],
  );

  const undo = useCallback(() => {
    setPast((prev) => {
      if (prev.length === 0) return prev;
      const snap = prev[prev.length - 1];
      setFuture((f) => [...f, { clips, ratio }]);
      setClips(snap.clips);
      setRatio(snap.ratio);
      return prev.slice(0, -1);
    });
  }, [clips, ratio]);

  const redo = useCallback(() => {
    setFuture((prev) => {
      if (prev.length === 0) return prev;
      const snap = prev[prev.length - 1];
      setPast((p) => [...p, { clips, ratio }]);
      setClips(snap.clips);
      setRatio(snap.ratio);
      return prev.slice(0, -1);
    });
  }, [clips, ratio]);

  /* ---------------- layer stack per clip ---------------- */

  const previousSelected = useRef<string | null>(null);
  useEffect(() => {
    const prev = previousSelected.current;
    // The stack follows whatever is UNDER THE PLAYHEAD, not what's selected —
    // a caption has to appear on the frame you're looking at.
    const activeClipId = current?.id ?? null;
    if (prev === activeClipId) return;
    if (prev) layersByClip.current[prev] = layers;
    previousSelected.current = activeClipId;
    replaceLayers(activeClipId ? (layersByClip.current[activeClipId] ?? []) : []);
    // `layers` is read, not depended on: this must fire when the clip under
    // the playhead changes, never when the stack itself does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, replaceLayers]);

  /* ---------------- adding media ---------------- */

  const addClips = useCallback(
    (created: Clip[]) => {
      if (created.length === 0) return;
      push();
      setClips((prev) => [...prev, ...created]);
    },
    [push],
  );

  // Filmstrip decoding, one clip at a time.
  //
  // A queue rather than firing them all off together: each frame is a seek, a
  // decode and a JPEG encode on the main thread, and four clips racing to do
  // that at once would visibly stutter the editor the strip is drawn in. The
  // strips fill in left to right, in the order the clips were added, which is
  // also the order the user is most likely to look at them.
  const filmstripQueue = useRef<Promise<void>>(Promise.resolve());
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

  const queueFilmstrip = useCallback((clipId: string, url: string, duration: number) => {
    filmstripQueue.current = filmstripQueue.current
      .then(() =>
        extractFilmstrip(
          url,
          duration,
          (frame) => {
            ownedUrls.current.push(frame.url);
            setClips((prev) =>
              prev.map((c) => (c.id === clipId ? { ...c, frames: [...c.frames, frame] } : c)),
            );
          },
          // Stops mid-clip when the screen goes away, and when the clip itself
          // is deleted — decoding frames for a tile nobody will see is pure
          // waste, and on a phone it is waste that costs battery.
          () => !alive.current || !liveClipIds.current.has(clipId),
        ),
      )
      // A clip whose frames can't be read (a remote file without CORS, say)
      // keeps its poster fallback rather than taking the queue down with it.
      .catch(() => {});
  }, []);

  const measurePhoto = useCallback((clip: Clip) => {
    const img = new Image();
    img.onload = () =>
      setClips((prev) =>
        prev.map((c) =>
          c.id === clip.id
            ? { ...c, naturalSize: { w: img.naturalWidth, h: img.naturalHeight } }
            : c,
        ),
      );
    img.src = clip.url;
  }, []);

  /** Read a video clip's length and poster frame.
   *
   *  `posterUrl` short-circuits the frame grab for clips picked from drafts or
   *  posts, which already have a stored thumbnail. That matters beyond speed:
   *  grabbing a frame means drawing a remote video to a canvas, which the
   *  browser blocks unless the bucket sends CORS headers. Using the stored
   *  poster avoids the question entirely.
   *
   *  Duration is required — a clip without one has no length on the timeline.
   *  A poster is not, so a failed grab downgrades to a plain tile instead of
   *  failing the whole add. */
  const measureVideo = useCallback(async (clip: Clip, posterUrl?: string | null) => {
    const duration = await videoDuration(clip.url);
    if (duration <= 0) {
      setError("Couldn't read how long one of those videos is");
      return;
    }

    let thumbUrl = posterUrl ?? null;
    let size: { w: number; h: number } | null = null;
    if (!thumbUrl) {
      try {
        const thumb = await videoThumbnail(clip.url);
        ownedUrls.current.push(thumb.url);
        thumbUrl = thumb.url;
        size = { w: thumb.w, h: thumb.h };
      } catch {
        thumbUrl = null;
      }
    }

    setClips((prev) =>
      prev.map((c) =>
        c.id === clip.id
          ? {
              ...c,
              thumbUrl,
              naturalSize: size ?? c.naturalSize,
              sourceDuration: duration,
              trimEnd: duration,
            }
          : c,
      ),
    );

    queueFilmstrip(clip.id, clip.url, duration);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDeviceFiles(files: FileList | null) {
    if (!files) return;
    const created: Clip[] = [];
    for (const file of Array.from(files)) {
      const isVideo = file.type.startsWith("video/");
      const isImage = file.type.startsWith("image/");
      if (!isVideo && !isImage) continue;
      const url = URL.createObjectURL(file);
      ownedUrls.current.push(url);
      created.push({
        id: newClipId(),
        kind: isVideo ? "video" : "photo",
        blob: file,
        url,
        remote: false,
        ...blankClipEdits(),
      });
    }
    addClips(created);
    // Measurement is async and per-clip; the timeline shows a placeholder
    // tile until each one reports back rather than blocking the whole add.
    created.forEach((c) => (c.kind === "video" ? void measureVideo(c) : measurePhoto(c)));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  /** Clips picked from drafts or published posts. Unlike the product form,
   *  which can only use stills, this screen takes both — an old video is as
   *  valid a piece of a new one as a photo is. */
  function handlePicked(picked: PickedMedia[]) {
    const created: Clip[] = picked.map((item) => ({
      id: newClipId(),
      kind: item.kind,
      blob: new Blob(),
      url: item.url,
      remote: true,
      ...blankClipEdits(),
    }));
    addClips(created);
    created.forEach((clip, i) =>
      clip.kind === "video" ? void measureVideo(clip, picked[i].thumbnailUrl) : measurePhoto(clip),
    );
    setDraftsOpen(false);
    setPostsOpen(false);
  }

  function openSource(e: React.MouseEvent<HTMLElement>) {
    setSourceAnchor(e.currentTarget.getBoundingClientRect());
    setSourceOpen(true);
  }

  function chooseSource(source: ImageSource) {
    setSourceOpen(false);
    if (source === "device") fileInputRef.current?.click();
    else if (source === "drafts") setDraftsOpen(true);
    else setPostsOpen(true);
  }

  function handleStickerFiles(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const url = URL.createObjectURL(file);
      ownedUrls.current.push(url);
      addLayer({
        id: `sticker-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        kind: "sticker",
        x: 0.5,
        y: 0.42,
        scale: 1,
        rotation: 0,
        zIndex: 0,
        assetUrl: url,
      });
    }
    if (stickerInputRef.current) stickerInputRef.current.value = "";
  }

  /* ---------------- timeline edits ---------------- */

  const patchClip = useCallback((id: string, patch: Partial<Clip>) => {
    // Not routed through commit(): trimming and sliders fire continuously, and
    // one undo step per pixel of drag would make undo useless. The snapshot for
    // these is taken when the gesture starts, in the handlers below.
    setClips((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  // One undo step per GESTURE, not per event. A trim handle fires on every
  // pixel of travel; without this, undo would walk back through a hundred
  // sub-frame nudges instead of the drag the user actually performed.
  const gestureOpen = useRef(false);
  const beginGesture = useCallback(() => {
    if (gestureOpen.current) return;
    gestureOpen.current = true;
    push();
  }, [push]);
  useEffect(() => {
    const end = () => {
      gestureOpen.current = false;
    };
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, []);

  function handleTrim(id: string, patch: Partial<Clip>) {
    beginGesture();
    patchClip(id, patch);
  }

  function handleReorder(from: number, to: number) {
    const clamped = Math.max(0, Math.min(to, clips.length - 1));
    if (clamped === from) return;
    beginGesture();
    setClips((prev) => moveClip(prev, from, clamped));
  }

  function handleSplit() {
    if (!head) return;
    const clip = clips[head.index];
    const parts = splitClip(clip, head.local);
    if (!parts) return;
    // The halves are new ids, so the layer stack has to be copied onto both or
    // a caption would vanish from one side of the cut.
    const stack = clip.id === current?.id ? layers : (layersByClip.current[clip.id] ?? []);
    layersByClip.current[parts[0].id] = stack;
    layersByClip.current[parts[1].id] = stack.map((l) => ({ ...l }));
    const next = clips.slice();
    next.splice(head.index, 1, parts[0], parts[1]);
    commit(next);
    setSelectedId(parts[1].id);
  }

  function handleDuplicate() {
    if (!selected) return;
    const index = clips.findIndex((c) => c.id === selected.id);
    const copy = { ...selected, id: newClipId() };
    layersByClip.current[copy.id] = (
      selected.id === current?.id ? layers : (layersByClip.current[selected.id] ?? [])
    ).map((l) => ({ ...l }));
    const next = clips.slice();
    next.splice(index + 1, 0, copy);
    commit(next);
    setSelectedId(copy.id);
  }

  function handleDelete() {
    if (!selected) return;
    delete layersByClip.current[selected.id];
    const next = clips.filter((c) => c.id !== selected.id);
    commit(next);
    setSelectedId(null);
    setTime((t) => Math.min(t, sequenceDuration(next)));
  }

  /* ---------------- playback ---------------- */

  const rafRef = useRef<number | null>(null);
  const lastWall = useRef(0);
  const timeRef = useRef(0);
  timeRef.current = time;

  useEffect(() => {
    if (!playing || empty) return;
    lastWall.current = performance.now();

    const tick = () => {
      const now = performance.now();
      const wallDelta = (now - lastWall.current) / 1000;
      lastWall.current = now;

      const at = locate(clips, timeRef.current);
      let next = timeRef.current + wallDelta;

      if (at) {
        const clip = clips[at.index];
        const video = videoRef.current;
        // A playing <video> is its own clock, and a more truthful one than the
        // wall — reading time back OUT of the element is what keeps picture
        // and sound together instead of slowly drifting apart.
        if (clip.kind === "video" && video && video.readyState >= 2 && !video.paused) {
          const local = (video.currentTime - clip.trimStart) / (clip.speed || 1);
          next = clipStarts(clips)[at.index] + Math.max(0, local);
          if (video.currentTime >= clip.trimEnd - 0.03) {
            next = clipStarts(clips)[at.index] + clipDuration(clip);
          }
        }
      }

      const end = sequenceDuration(clips);
      if (next >= end) {
        setTime(end);
        setPlaying(false);
        return;
      }
      setTime(next);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [playing, empty, clips]);

  // Keep the <video> element pointed at the right moment of the right clip.
  // Two distinct jobs: reload when the clip changes, and re-seek when the user
  // scrubs. Both are skipped mid-playback of a video clip, where the element
  // is the authority rather than the follower.
  const loadedClipId = useRef<string | null>(null);
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !current || current.kind !== "video") {
      loadedClipId.current = null;
      return;
    }
    if (loadedClipId.current !== current.id) {
      loadedClipId.current = current.id;
      video.src = current.url;
      video.load();
    }
    video.playbackRate = current.speed || 1;
    video.muted = current.muted;
  }, [current]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !head || !current || current.kind !== "video") return;
    if (playing && !video.paused) return;
    if (Math.abs(video.currentTime - head.source) > 0.08) {
      video.currentTime = head.source;
    }
  }, [head, current, playing]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (playing && current?.kind === "video") {
      void video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [playing, current?.kind, current?.id]);

  function togglePlay() {
    if (empty) return;
    setPlaying((p) => {
      if (!p && time >= total - 0.01) setTime(0);
      return !p;
    });
  }

  /* ---------------- preview appearance ---------------- */

  const previewingFilter =
    previewFilterId != null ? (CAMERA_FILTERS.find((f) => f.id === previewFilterId) ?? null) : null;
  const committedFilter =
    CAMERA_FILTERS.find((f) => f.id === current?.filterId) ?? CAMERA_FILTERS[0];
  const shownFilter = previewingFilter ?? committedFilter;
  const shownIntensity = previewFilterIntensity ?? current?.filterIntensity ?? 100;

  const previewCss = useMemo(() => {
    const base = previewCssAtIntensity(shownFilter, shownIntensity);
    const adj = adjustToCss(current?.adjust ?? NEUTRAL_ADJUST);
    const parts = [base === "none" ? "" : base, adj].filter(Boolean);
    return parts.length ? parts.join(" ") : "none";
  }, [shownFilter, shownIntensity, current?.adjust]);

  const fitted = useFittedSize(stageRef, ratioValue(ratio));

  /* ---------------- export ---------------- */

  async function handleNext() {
    if (empty) return;
    setPlaying(false);
    setError(null);
    setBusy("Making your video…");
    setProgress(0);
    try {
      // Park the live stack first, or the clip currently on screen would
      // export without the caption you can see on it.
      if (current) layersByClip.current[current.id] = layers;
      const blob = await exportSequence(clips, layersByClip.current, ratio, music, setProgress);
      const url = URL.createObjectURL(blob);

      // A cover for the publish screen. Without one it falls back to rendering
      // frame zero of the video element, which on a cut that opens dark is a
      // black square — and the cover is what the whole feed judges the post by.
      let poster: { blob: Blob; url: string } | undefined;
      try {
        const shot = await videoThumbnail(url, 0.1);
        const res = await fetch(shot.url);
        poster = { blob: await res.blob(), url: shot.url };
      } catch {
        poster = undefined;
      }

      setPendingCapture({ type: "video", blob, url, poster, origin: "video-editor" });

      // The unmount cleanup parks the timeline on its own, so backing out of
      // publish returns to the edit rather than an empty screen.
      await navigate({ to: "/create/after-shot/publish" });
    } catch (err) {
      console.error("VideoEditor: export failed", err);
      setError(err instanceof Error ? err.message : "Couldn't make that video");
    } finally {
      setBusy(null);
      setProgress(null);
    }
  }

  const closeTool = useCallback(() => setActiveTool(null), []);

  const TOOLS: { id: string; label: string; icon: typeof Type; run: () => void; off?: boolean }[] =
    [
      {
        id: "edit",
        label: "Edit",
        icon: Scissors,
        run: () => {
          if (!selectedId && current) setSelectedId(current.id);
          setActiveTool("clip");
        },
      },
      { id: "text", label: "Text", icon: Type, run: () => setActiveTool("text") },
      {
        id: "sticker",
        label: "Stickers",
        icon: Sticker,
        run: () => stickerInputRef.current?.click(),
      },
      { id: "filters", label: "Filters", icon: Wand2, run: () => setActiveTool("filter") },
      {
        id: "adjust",
        label: "Adjust",
        icon: SlidersHorizontal,
        run: () => setActiveTool("adjust"),
      },
      { id: "canvas", label: "Canvas", icon: Ratio, run: () => setActiveTool("ratio") },
      { id: "sound", label: "Sound", icon: Music, run: () => setActiveTool("sound") },
      {
        id: "effects",
        label: "Effects",
        icon: Sparkles,
        run: () => openSoon(SOON.effects),
        off: true,
      },
      { id: "magic", label: "Magic", icon: Wand2, run: () => openSoon(SOON.magic), off: true },
      {
        id: "captions",
        label: "Captions",
        icon: CaptionsIcon,
        run: () => openSoon(SOON.captions),
        off: true,
      },
      {
        id: "overlay",
        label: "Overlay",
        icon: Layers2,
        run: () => openSoon(SOON.overlay),
        off: true,
      },
      { id: "duplicate", label: "Duplicate", icon: Copy, run: handleDuplicate },
      { id: "delete", label: "Delete", icon: Trash2, run: handleDelete },
    ];

  function openSoon(info: SoonInfo) {
    setSoon(info);
    setActiveTool("soon");
  }

  const chromeHidden = activeTool !== null || expanded;

  return (
    <div
      className="fixed inset-0 overflow-hidden bg-black text-white"
      style={{ fontFamily: "'SF Pro', system-ui, sans-serif" }}
    >
      {/* Header — back out on the left, forward to publish on the right, the
          two directions this screen sits between. */}
      {!chromeHidden && (
        <div
          className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-4"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}
        >
          <button
            type="button"
            onClick={() => {
              // Leaving on purpose ends the edit, so the parked session goes
              // with it — otherwise the next New video would open onto the
              // timeline you just walked away from.
              discardVideoEditorSession();
              void navigate({ to: "/create" });
            }}
            aria-label="Back"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.14] active:scale-90"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            type="button"
            disabled={empty || !!busy}
            onClick={() => void handleNext()}
            aria-label="Next"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#fe2c55] active:scale-90 disabled:opacity-35"
          >
            <ArrowRight size={22} />
          </button>
        </div>
      )}

      {/* Preview stage */}
      <div
        ref={stageRef}
        className="absolute left-0 right-0 flex items-center justify-center px-4"
        style={{
          top: expanded ? 0 : "calc(env(safe-area-inset-top) + 68px)",
          bottom: expanded ? 90 : 292,
        }}
      >
        {empty ? (
          <button
            type="button"
            onClick={openSource}
            className="flex flex-col items-center gap-3 active:scale-95"
          >
            <span className="flex h-[76px] w-[76px] items-center justify-center rounded-full border border-white/25 bg-white/[0.06]">
              <Play size={30} className="ml-1" />
            </span>
            <span className="text-[13px] text-white/55">Add photos and videos</span>
            <span className="max-w-[220px] text-center text-[11px] leading-snug text-white/35">
              Everything you add becomes one video, in the order you put it.
            </span>
          </button>
        ) : (
          <div
            ref={frameRef}
            className="relative overflow-hidden rounded-[14px] bg-black"
            style={{ width: fitted.width || undefined, height: fitted.height || undefined }}
          >
            {current?.kind === "video" ? (
              <video
                ref={videoRef}
                playsInline
                preload="auto"
                className="h-full w-full"
                style={{ objectFit: current.fit, filter: previewCss }}
              />
            ) : (
              current && (
                <img
                  src={current.url}
                  alt=""
                  crossOrigin={current.remote ? "anonymous" : undefined}
                  className="h-full w-full"
                  style={{ objectFit: current.fit, filter: previewCss }}
                />
              )
            )}

            {(activeTool === null || activeTool === "text") && !expanded && (
              <div
                className="absolute inset-0"
                style={{ pointerEvents: activeTool === null ? undefined : "none" }}
              >
                <LayerOverlay
                  containerRef={frameRef}
                  layers={
                    activeTool === "text" ? layers.filter((l) => l.id !== editingLayerId) : layers
                  }
                  updateLayer={updateLayer}
                  selectedLayerId={activeTool === null ? selectedLayerId : null}
                  setSelectedLayerId={setSelectedLayerId}
                  renderLayerContent={renderLayerContent}
                  onLayerTap={(layer) => {
                    setEditingLayerId(layer.id);
                    setActiveTool("text");
                  }}
                />
              </div>
            )}

            {busy && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/75">
                <span className="text-[12px] uppercase tracking-widest">{busy}</span>
                {progress !== null && (
                  <div className="h-[3px] w-40 overflow-hidden rounded-full bg-white/15">
                    <div
                      className="h-full rounded-full bg-white transition-[width] duration-150"
                      style={{ width: `${Math.round(progress * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Expanded preview keeps only a scrubber and the way back out. */}
      {expanded && (
        <div
          className="absolute inset-x-0 bottom-0 z-30 flex items-center gap-3 px-5"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 18px)" }}
        >
          {/* Full screen still needs a transport. The one in the editing
              chrome is hidden here, and a preview you can only scrub is a
              preview you can't actually watch. */}
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? "Pause" : "Play"}
            className="flex h-9 w-9 shrink-0 items-center justify-center active:scale-90"
          >
            {playing ? <Pause size={20} fill="white" /> : <Play size={20} fill="white" />}
          </button>
          <span className="text-[12px] tabular-nums text-white/70">{formatTime(time)}</span>
          <input
            type="range"
            min={0}
            max={Math.max(total, 0.1)}
            step={0.01}
            value={time}
            onChange={(e) => {
              setPlaying(false);
              setTime(Number(e.target.value));
            }}
            aria-label="Scrub"
            className="oak-adjust-range flex-1"
          />
          <span className="text-[12px] tabular-nums text-white/70">{formatTime(total)}</span>
          <button
            type="button"
            onClick={() => setExpanded(false)}
            aria-label="Exit full screen"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-black active:scale-90"
          >
            <Minimize2 size={18} />
          </button>
        </div>
      )}

      {/* Panels */}
      <TextPanel
        open={activeTool === "text"}
        containerRef={frameRef}
        editingLayerId={editingLayerId}
        onClose={() => {
          setEditingLayerId(null);
          closeTool();
        }}
      />

      <FilterPanel
        open={activeTool === "filter"}
        selectedId={current?.filterId ?? "natural"}
        intensity={current?.filterIntensity ?? 100}
        favoriteIds={favoritedFilterIds}
        onClose={closeTool}
        onPreview={(id, intensity) => {
          setPreviewFilterId(id);
          setPreviewFilterIntensity(intensity);
        }}
        onApply={(id, intensity) => {
          if (current) {
            beginGesture();
            patchClip(current.id, { filterId: id, filterIntensity: intensity });
          }
          setPreviewFilterId(null);
          setPreviewFilterIntensity(null);
        }}
        onToggleFavorite={(id) =>
          setFavoritedFilterIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          })
        }
      />

      <PhotoAdjustPanel
        open={activeTool === "adjust"}
        value={current?.adjust ?? NEUTRAL_ADJUST}
        onChange={(adjust) => {
          if (!current) return;
          beginGesture();
          patchClip(current.id, { adjust });
        }}
        onClose={closeTool}
      />

      {activeTool === "clip" && (selected ?? current) && (
        <ClipSheet
          clip={(selected ?? current)!}
          onPatch={(patch) => {
            const target = selected ?? current;
            if (!target) return;
            beginGesture();
            patchClip(target.id, patch);
          }}
          onClose={closeTool}
        />
      )}

      {activeTool === "ratio" && (
        <RatioSheet
          ratio={ratio}
          onChange={(r) => {
            push();
            setRatio(r);
          }}
          onClose={closeTool}
        />
      )}

      {activeTool === "sound" && (
        <SoundSheet
          music={music}
          onPick={() => audioInputRef.current?.click()}
          onVolume={(volume) => setMusic((m) => (m ? { ...m, volume } : m))}
          onRemove={() => setMusic(null)}
          onClose={closeTool}
        />
      )}

      {activeTool === "transition" && <TransitionSheet onClose={closeTool} />}

      {activeTool === "soon" && soon && (
        <ComingSoonSheet title={soon.title} body={soon.body} onClose={closeTool} />
      )}

      {/* Transport, timeline and tools */}
      {!chromeHidden && (
        <div
          className="absolute inset-x-0 bottom-0 z-20"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 10px)" }}
        >
          <div className="flex items-center justify-between px-5 pb-3">
            <span className="text-[13px] tabular-nums text-white/85">
              {formatTime(time)}
              <span className="text-white/35"> / {formatTime(total)}</span>
            </span>
            <button
              type="button"
              onClick={togglePlay}
              disabled={empty}
              aria-label={playing ? "Pause" : "Play"}
              className="flex h-9 w-9 items-center justify-center active:scale-90 disabled:opacity-30"
            >
              {playing ? <Pause size={22} fill="white" /> : <Play size={22} fill="white" />}
            </button>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={undo}
                disabled={past.length === 0}
                aria-label="Undo"
                className="active:scale-90 disabled:opacity-25"
              >
                <Undo2 size={19} />
              </button>
              <button
                type="button"
                onClick={redo}
                disabled={future.length === 0}
                aria-label="Redo"
                className="active:scale-90 disabled:opacity-25"
              >
                <Redo2 size={19} />
              </button>
              <button
                type="button"
                onClick={() => setExpanded(true)}
                disabled={empty}
                aria-label="Full screen"
                className="active:scale-90 disabled:opacity-25"
              >
                <Maximize2 size={19} />
              </button>
            </div>
          </div>

          {empty ? (
            <div className="px-4 pb-3">
              <button
                type="button"
                onClick={openSource}
                className="flex h-[62px] w-full items-center justify-center gap-2 rounded-[10px] border border-dashed border-white/20 text-[13px] text-white/45 active:scale-[0.99]"
              >
                Your timeline is empty
              </button>
            </div>
          ) : (
            <VideoTimeline
              clips={clips}
              selectedId={selectedId}
              time={time}
              playing={playing}
              onSelect={setSelectedId}
              onSeek={(t) => {
                setPlaying(false);
                setTime(t);
              }}
              onTrim={handleTrim}
              onReorder={handleReorder}
              onAdd={openSource}
              onSplit={handleSplit}
              onToggleMute={(id) => {
                const clip = clips.find((c) => c.id === id);
                if (!clip) return;
                commit(clips.map((c) => (c.id === id ? { ...c, muted: !c.muted } : c)));
              }}
              onTransition={() => setActiveTool("transition")}
              onSound={() => setActiveTool("sound")}
              musicName={music?.name ?? null}
            />
          )}

          {error && (
            <div className="mx-4 mb-2 rounded-xl bg-black/80 px-4 py-2.5">
              <p className="text-[12px] text-red-300">{error}</p>
            </div>
          )}

          <div
            className="mt-2 flex items-start gap-1 overflow-x-auto px-3"
            style={{ scrollbarWidth: "none" }}
          >
            {TOOLS.map(({ id, label, icon: Icon, run, off }) => {
              const needsSelection = id === "duplicate" || id === "delete";
              return (
                <button
                  key={id}
                  type="button"
                  disabled={empty || (needsSelection && !selected)}
                  onClick={run}
                  className="flex w-[70px] shrink-0 flex-col items-center gap-1.5 rounded-[10px] bg-white/[0.07] py-2.5 active:scale-95 disabled:opacity-30"
                >
                  <Icon size={21} strokeWidth={1.7} className={off ? "text-white/55" : ""} />
                  <span className={`text-[11px] leading-tight ${off ? "text-white/55" : ""}`}>
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,image/*,image/heic,image/heif"
        multiple
        className="hidden"
        onChange={(e) => handleDeviceFiles(e.target.files)}
      />
      <input
        ref={stickerInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleStickerFiles(e.target.files)}
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          // No object URL: the file itself goes to the mixdown, and nothing on
          // this screen plays it back yet.
          if (file) setMusic({ file, name: file.name, volume: 0.7 });
          if (audioInputRef.current) audioInputRef.current.value = "";
        }}
      />

      {sourceOpen && (
        <ImageSourceSheet
          anchorRect={sourceAnchor}
          onSelect={chooseSource}
          onClose={() => setSourceOpen(false)}
        />
      )}
      {draftsOpen && (
        <DraftImagePickerSheet
          include="all"
          onSelect={handlePicked}
          onClose={() => setDraftsOpen(false)}
        />
      )}
      {postsOpen && (
        <PostImagePickerSheet
          include="all"
          onSelect={handlePicked}
          onClose={() => setPostsOpen(false)}
        />
      )}
    </div>
  );
}
