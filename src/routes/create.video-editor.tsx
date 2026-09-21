import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  Copy,
  Crop,
  Gauge,
  Maximize2,
  Minimize2,
  Music,
  Pause,
  Play,
  Ratio,
  Redo2,
  RefreshCw,
  Scissors,
  SlidersHorizontal,
  Split,
  Sticker,
  Trash2,
  Type,
  Undo2,
  Volume2,
  VolumeX,
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
  type EditorMusic,
  discardVideoEditorSession,
  parkVideoEditorSession,
  takeVideoEditorSession,
} from "@/lib/video-editor-session";
import { setPendingCapture } from "@/lib/capture-handoff";
import { takePendingDraft } from "@/lib/draft-handoff";
import VideoTimeline from "@/components/create/VideoTimeline";
import { SpeedSheet, RatioSheet, SoundSheet } from "@/components/create/ClipOptionSheets";
import { exportSequence } from "@/lib/video-sequence-export";
import SoundLibrarySheet from "@/components/camera/SoundLibrarySheet";
import { authedFetch } from "@/lib/authed-fetch";
import { type LibraryTrack, type SoundCredit, creditFor } from "@/lib/sound-library";
import {
  blankClipEdits,
  clipDuration,
  clipStarts,
  MIN_CLIP_DURATION,
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
// Nothing on this screen is decoration. Effects, Magic, Captions, Overlay and
// transitions used to be drawn here and open a sheet admitting they weren't
// wired up; they are gone rather than greyed, because a tool you cannot use is
// worse than a tool that isn't there — it reads as broken rather than absent.
// Everything here does what it looks like it does — Sound
// included, which picks a track from the catalogue and mixes it under the
// whole timeline. It is the only screen that needs the track's actual bytes in
// the browser, because it welds the music into the MP4 instead of uploading it
// beside the media; see `chooseTrack`.

type ToolId = "speed" | "text" | "sticker" | "filter" | "adjust" | "ratio" | "sound";

/** Snapshot of everything undo/redo restores.
 *
 *  Text and sticker layers are deliberately NOT in here: they have their own
 *  selection and editing affordances, and folding them in would make an undo
 *  mid-caption mean two different things depending on which panel was open.
 *
 *  The music track IS, because it is a property of the whole timeline rather
 *  than of a panel — and because removing one is the one destructive action on
 *  this screen that undo could not take back. Re-picking costs a second trip
 *  to the catalogue and several megabytes of somebody's mobile data. */
type Snapshot = { clips: Clip[]; ratio: ProjectRatio; music: EditorMusic | null };

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
  //
  // The credit travels with the file. This screen mixes the track INTO the
  // MP4, so once the export runs there is no way to recover what was in it —
  // the credit has to be carried from the moment the track is picked, or the
  // post goes out with music and no attribution.
  const [music, setMusic] = useState<EditorMusic | null>(() => session?.music ?? null);
  // A credit carried in from a reopened draft, for music already welded into
  // one of the clips. Separate from `music` because there is no file to go with
  // it and nothing to re-mix — only an obligation to keep crediting it.
  const [inheritedCredit, setInheritedCredit] = useState<SoundCredit | null>(
    () => session?.inheritedCredit ?? null,
  );
  const [inheritedName, setInheritedName] = useState<string | null>(
    () => session?.inheritedName ?? null,
  );
  // Edit mode. Tapping Edit does not open anything over the timeline — it
  // selects the clip under the playhead and swaps the toolbar underneath for
  // that clip's own actions. A sheet was the wrong shape for this: the thing
  // being edited is the clip on the timeline, and a panel covering the
  // timeline hides it at exactly the moment it matters.
  const [clipEditing, setClipEditing] = useState(false);
  // Set while the media picker is being used to REPLACE a clip rather than add
  // one. The picker is the same; where its result goes is not.
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null);
  const [soundOpen, setSoundOpen] = useState(false);
  const [soundLoading, setSoundLoading] = useState(false);
  const [soundError, setSoundError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stickerInputRef = useRef<HTMLInputElement>(null);
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
  const latest = useRef({
    clips,
    ratio,
    time,
    layers,
    music,
    inheritedCredit,
    inheritedName,
    currentId: null as string | null,
  });

  const total = sequenceDuration(clips);
  const head = locate(clips, time);
  const current = head ? clips[head.index] : null;
  const selected = clips.find((c) => c.id === selectedId) ?? null;

  latest.current = {
    clips,
    ratio,
    time,
    layers,
    music,
    inheritedCredit,
    inheritedName,
    currentId: current?.id ?? null,
  };
  // Read by the filmstrip queue to know whether a clip it is still decoding
  // for is one the user has since deleted.
  const liveClipIds = useRef(new Set<string>());
  liveClipIds.current = new Set(clips.map((c) => c.id));
  useEffect(
    () => () => {
      const {
        clips: c,
        ratio: r,
        time: t,
        layers: l,
        music: m,
        inheritedCredit: ic,
        inheritedName: iname,
        currentId,
      } = latest.current;
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
        inheritedCredit: ic,
        inheritedName: iname,
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
    setPast((prev) => [...prev, { clips, ratio, music }].slice(-40));
    setFuture([]);
  }, [clips, ratio, music]);

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
      setFuture((f) => [...f, { clips, ratio, music }]);
      setClips(snap.clips);
      setRatio(snap.ratio);
      setMusic(snap.music);
      return prev.slice(0, -1);
    });
  }, [clips, ratio, music]);

  const redo = useCallback(() => {
    setFuture((prev) => {
      if (prev.length === 0) return prev;
      const snap = prev[prev.length - 1];
      setPast((p) => [...p, { clips, ratio, music }]);
      setClips(snap.clips);
      setRatio(snap.ratio);
      setMusic(snap.music);
      return prev.slice(0, -1);
    });
  }, [clips, ratio, music]);

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
    // Replacing takes the first file and ignores the rest: one clip is being
    // swapped for one other, and quietly appending the extras would be a
    // different edit from the one that was asked for.
    const target = replaceTargetId ? clips.find((c) => c.id === replaceTargetId) : null;
    if (target) {
      const file = Array.from(files).find(
        (f) => f.type.startsWith("video/") || f.type.startsWith("image/"),
      );
      if (file) {
        const url = URL.createObjectURL(file);
        ownedUrls.current.push(url);
        replaceClip(target, {
          kind: file.type.startsWith("video/") ? "video" : "photo",
          blob: file,
          url,
          remote: false,
        });
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
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

  // A draft tapped on the drafts page. Added through the same path as any
  // other remote pick, so it arrives with a duration, a poster and a
  // filmstrip rather than as a special case that has none of them.
  const draftLoaded = useRef(false);
  useEffect(() => {
    if (draftLoaded.current) return;
    draftLoaded.current = true;
    const draft = takePendingDraft();
    if (!draft) return;
    const clip: Clip = {
      id: newClipId(),
      kind: draft.kind,
      blob: new Blob(),
      url: draft.url,
      remote: true,
      ...blankClipEdits(),
    };
    addClips([clip]);
    if (clip.kind === "video") void measureVideo(clip, draft.thumbnailUrl);
    else measurePhoto(clip);

    // A draft made on this screen has its music INSIDE the MP4, which is what
    // `audio_licence` with no `audio_url` means. Re-exporting that clip carries
    // the track into the new file, so the credit has to come with it — nothing
    // about the timeline can recover it afterwards, and a republished post
    // playing a CC BY track with an empty attribution column is the precise
    // failure this catalogue exists to prevent.
    //
    // A draft WITH an `audio_url` is a detached track this screen cannot play.
    // That one is still lost, deliberately — it is the older gap written up in
    // POSTPONED 0.2, and inheriting a credit for music the export will not
    // contain would trade a silent bug for a false claim.
    if (draft.audioLicence && !draft.audioUrl) {
      setInheritedCredit({
        attribution: draft.audioAttribution ?? null,
        licence: draft.audioLicence,
        sourceUrl: draft.audioSourceUrl ?? "",
      });
      setInheritedName(draft.audioName ?? null);
    }
  }, [addClips, measureVideo, measurePhoto]);

  /** Clips picked from drafts or published posts. Unlike the product form,
   *  which can only use stills, this screen takes both — an old video is as
   *  valid a piece of a new one as a photo is. */
  function handlePicked(picked: PickedMedia[]) {
    const target = replaceTargetId ? clips.find((c) => c.id === replaceTargetId) : null;
    if (target && picked[0]) {
      const item = picked[0];
      replaceClip(
        target,
        { kind: item.kind, blob: new Blob(), url: item.url, remote: true },
        item.thumbnailUrl,
      );
      setDraftsOpen(false);
      setPostsOpen(false);
      return;
    }
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

  /** Swap a clip's source, keeping the look the seller gave it.
   *
   *  Filter, tone, fit and mute survive; trim, filmstrip and duration cannot,
   *  because they describe the old file. A photo keeps how long it holds, which
   *  is the one duration that belongs to the edit rather than to the source. */
  function replaceClip(
    target: Clip,
    next: Pick<Clip, "kind" | "blob" | "url" | "remote">,
    poster?: string | null,
  ) {
    push();
    const replaced: Clip = {
      ...target,
      ...next,
      naturalSize: null,
      sourceDuration: 0,
      trimStart: 0,
      trimEnd: 0,
      thumbUrl: null,
      frames: [],
    };
    setClips((prev) => prev.map((c) => (c.id === target.id ? replaced : c)));
    setReplaceTargetId(null);
    if (replaced.kind === "video") void measureVideo(replaced, poster ?? null);
    else measurePhoto(replaced);
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
    // The clip the toolbar was about is gone, so the toolbar goes too. Falling
    // through to whatever the playhead lands on next would leave Delete under
    // the same thumb that just pressed it, aimed at a different clip.
    setClipEditing(false);
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
    // Same "none" guard as create.photo-editor.tsx's previewCss — adjustToCss
    // returns the literal string "none" rather than "" when untouched, and
    // without this guard it gets appended onto a real filter as invalid CSS
    // (e.g. "contrast(1.2) ... none"), which drops the whole declaration.
    const parts = [base === "none" ? "" : base, adj === "none" ? "" : adj].filter(Boolean);
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
      const { blob, musicIncluded } = await exportSequence(
        clips,
        layersByClip.current,
        ratio,
        music,
        setProgress,
      );
      // A track was chosen and the mixer could not decode it. Going on would
      // hand the seller a silent video they believe has music, and they would
      // find out in the feed. Stopping here costs a re-export if they try
      // again, which is the cheaper of the two surprises.
      if (music && !musicIncluded) {
        setError("That track couldn't be added to the video. Try another one.");
        return;
      }

      const url = URL.createObjectURL(blob);

      // What the finished file is actually playing. `music` is past the decode
      // check by this point; `inheritedCredit` is a track welded into a clip by
      // an earlier session, which is inside the file either way.
      const bakedCredit = music?.credit ?? inheritedCredit;

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

      setPendingCapture({
        type: "video",
        blob,
        url,
        poster,
        origin: "video-editor",
        // The track is inside `blob` now. `bakedIn` is what tells publish to
        // send the credit and no bytes — the post plays that music, so the row
        // has to say so even though there is no separate file to store.
        //
        // Two sources, and both have to be honoured. `music` is a track picked
        // on this visit, and it only counts if the mixer actually decoded it —
        // crediting a track the file does not contain is as wrong as omitting
        // one it does. `inheritedCredit` is a track welded into a clip by an
        // earlier session, which no amount of inspecting the timeline can
        // recover; see the draft-restore effect.
        audio: bakedCredit
          ? {
              blob: null,
              url: "",
              name: music ? music.name : (inheritedName ?? "Sound"),
              credit: bakedCredit,
              bakedIn: true,
            }
          : undefined,
      });

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

  /** Take a track from the catalogue and put it on the timeline.
   *
   *  Unlike every other screen that picks a sound, this one needs the actual
   *  bytes: the export mixes the music into the MP4 rather than uploading it
   *  beside the media, and `OfflineAudioContext` cannot decode a URL it is not
   *  allowed to read. So the file comes down through `/api/sound-file`, which
   *  is the same allowlisted server-side fetch the publish path uses — the
   *  browser is not permitted to reach these hosts directly, and that is on
   *  purpose rather than an obstacle to route around.
   *
   *  It is a few megabytes over what may be a mobile connection, which is why
   *  the sheet says it is working and stays open until this resolves. */
  const chooseTrack = useCallback(
    async (track: LibraryTrack) => {
      setSoundLoading(true);
      setSoundError(null);
      try {
        // The access stamp travels with the track from `/api/sounds`. Without
        // it the proxy refuses — it only serves URLs the catalogue issued, so a
        // track assembled anywhere else cannot be laundered through it.
        const query = new URLSearchParams({ url: track.streamUrl });
        if (track.access) {
          query.set("sig", track.access.sig);
          query.set("exp", String(track.access.exp));
        }
        const res = await authedFetch(`/api/sound-file?${query.toString()}`);
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? "Couldn't load that sound");
        }
        const blob = await res.blob();
        // A name for the mixer, not for the seller — the credit is what the post
        // shows. The extension keeps `decodeAudioData` from having to guess.
        const file = new File([blob], "track.mp3", { type: blob.type || "audio/mpeg" });
        const next: EditorMusic = {
          file,
          name: track.title,
          // Under the clips rather than over them: this is a backing track for a
          // garment video, and a seller talking about the fit has to win.
          volume: 0.7,
          credit: creditFor(track),
        };
        // Snapshot before it changes, so undo takes the pick back rather than
        // skipping past it to whatever happened before. Volume is left out on
        // purpose — a slider would push forty snapshots on one drag.
        push();
        setMusic((m) => (m ? { ...next, volume: m.volume } : next));
        setSoundOpen(false);
      } catch (err) {
        console.error("VideoEditor: could not fetch track", err);
        setSoundError("Couldn't load that sound. Check your connection and try another.");
      } finally {
        setSoundLoading(false);
      }
    },
    [push],
  );

  const closeTool = useCallback(() => setActiveTool(null), []);

  const TOOLS: { id: string; label: string; icon: typeof Type; run: () => void; off?: boolean }[] =
    [
      {
        id: "edit",
        label: "Edit",
        icon: Scissors,
        run: () => {
          // Whatever the playhead is standing on is what you meant to edit.
          if (current) setSelectedId(current.id);
          setClipEditing(true);
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
      { id: "duplicate", label: "Duplicate", icon: Copy, run: handleDuplicate },
      { id: "delete", label: "Delete", icon: Trash2, run: handleDelete },
    ];

  /** The toolbar while a clip is selected for editing.
   *
   *  Built per clip rather than fixed, because a photo has no audio to mute
   *  and holds for a duration where a video runs at a speed. An action that
   *  cannot apply is left OUT rather than greyed: a disabled button invites a
   *  tap and then explains itself, which is a worse answer than not being
   *  there. */
  const editTarget = selected ?? current;
  // Splitting needs the playhead strictly inside the clip being edited, with
  // room for a clip on each side — the same rule the timeline's own Split
  // button uses, so the two never disagree about whether a cut is possible.
  const editStarts = clipStarts(clips);
  const editIndex = editTarget ? clips.findIndex((c) => c.id === editTarget.id) : -1;
  const canSplitHere =
    editIndex >= 0 &&
    time > editStarts[editIndex] + MIN_CLIP_DURATION &&
    time < editStarts[editIndex + 1] - MIN_CLIP_DURATION;
  const CLIP_TOOLS: { id: string; label: string; icon: typeof Type; run: () => void }[] = editTarget
    ? [
        { id: "split", label: "Split", icon: Split, run: handleSplit },
        {
          id: "replace",
          label: "Replace",
          icon: RefreshCw,
          run: () => {
            setReplaceTargetId(editTarget.id);
            setSourceAnchor(null);
            setSourceOpen(true);
          },
        },
        {
          id: "speed",
          label: editTarget.kind === "photo" ? "Duration" : "Speed",
          icon: Gauge,
          run: () => setActiveTool("speed"),
        },
        {
          id: "fit",
          label: editTarget.fit === "cover" ? "Fit" : "Fill",
          icon: Crop,
          run: () => {
            beginGesture();
            patchClip(editTarget.id, { fit: editTarget.fit === "cover" ? "contain" : "cover" });
          },
        },
        ...(editTarget.kind === "video"
          ? [
              {
                id: "volume",
                label: editTarget.muted ? "Unmute" : "Mute",
                icon: editTarget.muted ? VolumeX : Volume2,
                run: () => {
                  beginGesture();
                  patchClip(editTarget.id, { muted: !editTarget.muted });
                },
              },
            ]
          : []),
        { id: "filters", label: "Filters", icon: Wand2, run: () => setActiveTool("filter") },
        {
          id: "adjust",
          label: "Adjust",
          icon: SlidersHorizontal,
          run: () => setActiveTool("adjust"),
        },
        { id: "duplicate", label: "Duplicate", icon: Copy, run: handleDuplicate },
        { id: "delete", label: "Delete", icon: Trash2, run: handleDelete },
      ]
    : [];

  // Nothing to edit means nothing to be in edit mode about — an emptied
  // timeline must not leave the clip toolbar on screen.
  useEffect(() => {
    if (empty) setClipEditing(false);
  }, [empty]);

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
              void navigate({ to: "/create", search: { tab: "create" } });
            }}
            aria-label="Back"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.14] active:scale-90"
          >
            <ChevronLeft size={22} />
          </button>
          <h1 className="text-[15px] font-semibold">Video post</h1>
          <button
            type="button"
            disabled={empty || !!busy}
            onClick={() => void handleNext()}
            aria-label="Continue to publish"
            className="flex h-11 items-center justify-center gap-1.5 rounded-full bg-[var(--oak-action)] px-4 text-[13px] font-semibold active:scale-90 disabled:opacity-35"
          >
            <span>Next</span>
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
            aria-label="Start with photos or videos"
          >
            <span className="flex h-[76px] w-[76px] items-center justify-center rounded-full border border-white/25 bg-white/[0.06]">
              <Play size={30} className="ml-1" />
            </span>
            <span className="text-base font-semibold text-white">Start with photos or videos</span>
            <span className="max-w-[260px] text-center text-[13px] leading-relaxed text-white/55">
              Choose media from your device, drafts, or posts. Everything becomes one video in
              order.
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
                disablePictureInPicture
                disableRemotePlayback
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

      {activeTool === "speed" && editTarget && (
        <SpeedSheet
          clip={editTarget}
          onPatch={(patch) => {
            beginGesture();
            patchClip(editTarget.id, patch);
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
          onPick={() => {
            setSoundError(null);
            setSoundOpen(true);
          }}
          loading={soundLoading}
          error={soundError}
          onVolume={(volume) => setMusic((m) => (m ? { ...m, volume } : m))}
          onRemove={() => {
            push();
            setMusic(null);
          }}
          onClose={closeTool}
        />
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
                Add media to start your video
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
            {clipEditing && editTarget ? (
              <>
                {/* Out of edit mode, back to the whole-video tools. First on
                    the left and pinned there: it is the one button in this bar
                    that is not about the clip, and the way back has to be
                    somewhere the thumb can find without reading. */}
                <button
                  type="button"
                  onClick={() => {
                    setClipEditing(false);
                    setSelectedId(null);
                  }}
                  aria-label="Done editing this clip"
                  className="sticky left-0 z-10 flex w-[52px] shrink-0 flex-col items-center justify-center self-stretch rounded-[10px] bg-white/[0.14] py-2.5 backdrop-blur active:scale-95"
                >
                  <ChevronDown size={21} strokeWidth={1.7} />
                </button>
                {CLIP_TOOLS.map(({ id, label, icon: Icon, run }) => (
                  <button
                    key={id}
                    type="button"
                    disabled={id === "split" && !canSplitHere}
                    onClick={run}
                    aria-label={label}
                    className="flex w-[70px] shrink-0 flex-col items-center gap-1.5 rounded-[10px] bg-white/[0.07] py-2.5 active:scale-95 disabled:opacity-30"
                  >
                    <Icon size={21} strokeWidth={1.7} />
                    <span className="text-[11px] leading-tight">{label}</span>
                  </button>
                ))}
              </>
            ) : (
              TOOLS.map(({ id, label, icon: Icon, run }) => {
                const needsSelection = id === "duplicate" || id === "delete";
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={empty || (needsSelection && !selected)}
                    onClick={run}
                    aria-label={label}
                    className={`flex w-[70px] shrink-0 flex-col items-center gap-1.5 rounded-[10px] bg-white/[0.07] py-2.5 active:scale-95 disabled:opacity-30 ${activeTool === id ? "ring-2 ring-white/30" : ""}`}
                  >
                    <Icon size={21} strokeWidth={1.7} />
                    <span className="text-[11px] leading-tight">{label}</span>
                  </button>
                );
              })
            )}
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
      {/* The device audio picker that used to be here is gone. See the note on
          `SoundSheet` — this screen bakes the track into the MP4 we then serve
          publicly, so the catalogue is the only source we can stand behind. */}
      <SoundLibrarySheet
        open={soundOpen}
        onClose={() => setSoundOpen(false)}
        onPick={chooseTrack}
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
