import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  Crop,
  Music,
  Pause,
  Pencil,
  Play,
  Download,
  Plus,
  Settings,
  SlidersHorizontal,
  Sticker,
  Trash2,
  Type,
  Wand2,
  X,
} from "lucide-react";
import {
  AfterShotLayersContext,
  useAfterShotLayers,
  useAfterShotLayersState,
} from "@/lib/after-shot-layers";
import type { Layer } from "@/lib/after-shot-layers";
import TextPanel from "@/components/camera/aftershot/TextPanel";
import CropPanel from "@/components/camera/aftershot/CropPanel";
import DrawPanel from "@/components/camera/aftershot/DrawPanel";
import FilterPanel from "@/components/camera/FilterPanel";
import PhotoAdjustPanel from "@/components/create/PhotoAdjustPanel";
import { CAMERA_FILTERS, previewCssAtIntensity } from "@/components/camera/filter-data";
import LayerOverlay from "@/components/camera/LayerOverlay";
import { useLayerRenderer } from "@/components/camera/aftershot/use-layer-renderer";
import { useLockedViewport } from "@/hooks/use-locked-viewport";
import { useFittedSize } from "@/hooks/use-fitted-size";
import { exportComposite, exportPhoto } from "@/lib/after-shot-export";
import { videoDuration, videoThumbnail } from "@/lib/video-sequence";
import { adjustToCss, NEUTRAL_ADJUST, type PhotoAdjust } from "@/lib/photo-adjust";
import type { CropRect } from "@/lib/crop-rect";
import { ImageSourceSheet, type ImageSource } from "@/components/product-form/ImageSourceSheet";
import { DraftImagePickerSheet } from "@/components/product-form/DraftImagePickerSheet";
import { PostImagePickerSheet } from "@/components/product-form/PostImagePickerSheet";
import type { PickedMedia } from "@/components/product-form/MediaPickerSheet";
import { setPendingCapture, soundLabel, takePendingCapture } from "@/lib/capture-handoff";
import {
  blankPhotoEdits,
  discardPhotoEditorSession,
  newPhotoId,
  parkPhotoEditorSession,
  takePhotoEditorSession,
  LIVE_MAX_SECONDS,
  type CarouselPhoto,
  type PhotoKind,
  type PhotoSound,
} from "@/lib/photo-carousel";
import { takePendingDraft } from "@/lib/draft-handoff";

export const Route = createFileRoute("/create/photo-editor")({
  head: () => ({ meta: [{ title: "Photo editor — Oakmonte" }] }),
  component: PhotoEditorRoute,
});

// The photo editor. One picture, several as a carousel, or a single live
// photo — reached from the CREATE tab. It is NOT the after-shot screen: that one edits a single
// thing you just captured and hands it straight to publish. This one starts
// empty, takes images from anywhere (device, drafts, existing posts), and the
// edit stack belongs to whichever photo you have selected.
//
// It reuses after-shot's panels wholesale — TextPanel, CropPanel, FilterPanel,
// LayerOverlay, the layer renderer — because "put a caption on an image" should
// not have two implementations that drift. What it does NOT reuse is
// after-shot-context: that context carries exactly one CapturedMedia, and a
// carousel has many.
//
// Deliberately absent, per the brief: photo templates and Enhance. Stories
// don't exist in this product.
//
// Sound DOES belong here, though it took a second pass to see why: a track is
// not mixed into the picture, it is played over the post, so a still can carry
// one without becoming a video. See PhotoSound in photo-carousel.ts.

const DEFAULT_FILTER_ID = "natural";

// Reorder-by-hold, in numbers.
//
// 320ms matches the camera's hold-for-a-live-photo, so "hold to do the other
// thing" means one duration across the app rather than two that feel subtly
// different. The slop is what a still finger actually produces on a phone —
// tighter and the gesture never fires for anyone resting their thumb.
const HOLD_MS = 320;
const HOLD_SLOP = 8;
/** Thumbnail width plus the gap between them: one slot. */
const DRAG_STRIDE = 54;
const EDGE_ZONE = 44;
const EDGE_SPEED = 9;

function clampIndex(value: number, length: number): number {
  return Math.max(0, Math.min(length - 1, value));
}

type ToolId = "text" | "draw" | "sticker" | "filter" | "crop" | "adjust";

const TOOLS: { id: ToolId; label: string; icon: typeof Type }[] = [
  { id: "text", label: "Text", icon: Type },
  // Draw arrived when this screen stopped routing through after-shot. It was
  // the one tool that detour still added, and dropping it silently would have
  // made "go straight to publish" a downgrade rather than a shortcut.
  { id: "draw", label: "Draw", icon: Pencil },
  { id: "sticker", label: "Stickers", icon: Sticker },
  { id: "filter", label: "Filters", icon: Wand2 },
  { id: "crop", label: "Crop", icon: Crop },
  { id: "adjust", label: "Adjust", icon: SlidersHorizontal },
];

// The carousel's shape, its blank edits and the session that carries it to
// publish all live in photo-carousel.ts — see the note there on why.
type EditPhoto = CarouselPhoto;

function PhotoEditorRoute() {
  const layerState = useAfterShotLayersState();
  return (
    <AfterShotLayersContext.Provider value={layerState}>
      <PhotoEditor />
    </AfterShotLayersContext.Provider>
  );
}

function PhotoEditor() {
  useLockedViewport();
  const navigate = useNavigate();
  const { layers, addLayer, updateLayer, replaceLayers, selectedLayerId, setSelectedLayerId } =
    useAfterShotLayers();

  const mediaAreaRef = useRef<HTMLDivElement>(null);
  const mediaBoxRef = useRef<HTMLDivElement>(null);
  const renderLayerContent = useLayerRenderer(mediaBoxRef);

  // Claimed once per mount, BEFORE the state below is initialised, so a
  // carousel coming back from publish is on screen from the first render
  // rather than a frame after an empty one.
  const [session] = useState(takePhotoEditorSession);

  const [photos, setPhotos] = useState<EditPhoto[]>(() => session?.photos ?? []);
  const [activeId, setActiveId] = useState<string | null>(() => session?.activeId ?? null);
  // One layer stack per photo. The shared layer context only holds one at a
  // time, so switching photos parks the current stack here and hands the
  // incoming one over.
  const layersByPhoto = useRef<Record<string, Layer[]>>(session?.layersByPhoto ?? {});

  // The post's sound. Lives beside the photos rather than on one of them —
  // it belongs to the post, and moving it when the selection changes would be
  // a surprise every time.
  const [sound, setSound] = useState<PhotoSound | null>(() => session?.sound ?? null);
  const [auditioning, setAuditioning] = useState(false);

  const [activeTool, setActiveTool] = useState<ToolId | null>(null);
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [previewFilterId, setPreviewFilterId] = useState<string | null>(null);
  const [previewFilterIntensity, setPreviewFilterIntensity] = useState<number | null>(null);
  const [favoritedFilterIds, setFavoritedFilterIds] = useState<Set<string>>(new Set());

  const [sourceOpen, setSourceOpen] = useState(false);
  const [sourceAnchor, setSourceAnchor] = useState<DOMRect | null>(null);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [postsOpen, setPostsOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const stickerInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const audioElRef = useRef<HTMLAudioElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  // Drag state is mirrored in refs as well as state: the render needs it, and
  // the pointer handlers need to read the CURRENT value on pointerup without
  // closing over a stale one.
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragDx, setDragDx] = useState(0);
  const dragDxRef = useRef(0);
  const pointerXRef = useRef(0);
  const autoScrollRef = useRef<number | null>(null);

  // How much room the controls at the bottom actually take. 210 is only the
  // starting guess for the first paint, before the observer has measured.
  const bottomStackRef = useRef<HTMLDivElement>(null);
  const [bottomInset, setBottomInset] = useState(210);
  const ownedUrls = useRef<string[]>(session?.ownedUrls ?? []);

  const active = photos.find((p) => p.id === activeId) ?? null;

  // Where the dragged tile currently wants to land, and how far every other
  // tile has to step aside to open that slot. Computed rather than applied to
  // `photos` as the finger moves: mutating the array live would move the tile
  // out from under its own transform and fight the gesture.
  const dragIndex = dragId ? photos.findIndex((p) => p.id === dragId) : -1;
  const dragTarget =
    dragIndex >= 0 ? clampIndex(dragIndex + Math.round(dragDx / DRAG_STRIDE), photos.length) : -1;

  function tileShift(i: number): number {
    if (dragIndex < 0) return 0;
    if (i === dragIndex) return dragDx;
    if (dragTarget > dragIndex && i > dragIndex && i <= dragTarget) return -DRAG_STRIDE;
    if (dragTarget < dragIndex && i < dragIndex && i >= dragTarget) return DRAG_STRIDE;
    return 0;
  }
  // A live photo owns the whole post, so its presence is a state of the whole
  // screen rather than a property of the selected item.
  const hasLive = photos.some((p) => p.kind === "live");

  // Leaving parks the carousel rather than destroying it, so backing out of
  // publish returns to the edit. Ownership of the object URLs goes with it and
  // photo-carousel.ts becomes the only place they are freed.
  //
  // Revoking here on unmount, which is what this used to do, is wrong in a way
  // that only shows up when it runs: StrictMode mounts, unmounts and remounts
  // every component in dev, so the cleanup fired on a screen that was coming
  // straight back and every photo returned as a dead blob URL. The video
  // editor carries the same note for the same reason.
  const latest = useRef({ photos, activeId, layers, sound });
  latest.current = { photos, activeId, layers, sound };
  useEffect(
    () => () => {
      const { photos: p, activeId: a, layers: l, sound: s } = latest.current;
      if (p.length === 0) return;
      if (a) layersByPhoto.current[a] = l;
      parkPhotoEditorSession({
        photos: p,
        layersByPhoto: layersByPhoto.current,
        activeId: a,
        sound: s,
        ownedUrls: ownedUrls.current,
      });
    },
    [],
  );

  // Park the outgoing stack, load the incoming one. Keyed on activeId only —
  // running on every `layers` change would fight the panels mid-edit.
  const previousActiveId = useRef<string | null>(null);
  useEffect(() => {
    const prev = previousActiveId.current;
    if (prev === activeId) return;
    if (prev) layersByPhoto.current[prev] = layers;
    previousActiveId.current = activeId;
    replaceLayers(activeId ? (layersByPhoto.current[activeId] ?? []) : []);
    // `layers` is read, not depended on: this must fire when the SELECTION
    // changes, never when the stack itself does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, replaceLayers]);

  // Re-measured whenever the stack changes shape — a sound chip appearing, the
  // hint going away mid-drag, a second row of anything added later.
  useEffect(() => {
    const el = bottomStackRef.current;
    if (!el) return;
    const measure = () => setBottomInset(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [activeTool]);

  // Keep the selected thumbnail on screen. Without this, moving a photo past
  // the edge of the visible strip looks like it vanished — the arrows would
  // appear to delete rather than reorder.
  useEffect(() => {
    if (!activeId) return;
    stripRef.current
      ?.querySelector<HTMLElement>(`[data-photo-id="${CSS.escape(activeId)}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [activeId, photos]);

  const patchActive = useCallback(
    (patch: Partial<EditPhoto>) => {
      setPhotos((prev) => prev.map((p) => (p.id === activeId ? { ...p, ...patch } : p)));
    },
    [activeId],
  );

  function addPhotos(items: { blob?: Blob; url: string; remote: boolean; kind?: PhotoKind }[]) {
    if (items.length === 0) return;
    const created: EditPhoto[] = items.map((it) => ({
      id: newPhotoId(),
      kind: it.kind ?? "photo",
      blob: it.blob ?? new Blob(),
      url: it.url,
      remote: it.remote,
      ...blankPhotoEdits(),
    }));
    setPhotos((prev) => [...prev, ...created]);
    setActiveId((cur) => cur ?? created[0].id);
  }

  async function handleDeviceFiles(files: FileList | null) {
    if (!files) return;
    const picked = Array.from(files);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setError(null);

    // An iOS Live Photo picked from the library arrives as the still half
    // only — the movie beside it is not reachable from the web at all, from
    // any API. So a live photo here means a short clip: one the seller filmed,
    // or one our own camera recorded on a held shutter.
    const clips = picked.filter((f) => f.type.startsWith("video/"));
    const stills = picked.filter((f) => f.type.startsWith("image/"));

    if (clips.length > 0) {
      if (stills.length > 0 || clips.length > 1 || photos.length > 0) {
        setError("A live photo goes on its own — it can't share a post with other pictures.");
        return;
      }
      const clip = clips[0];
      const url = URL.createObjectURL(clip);
      const seconds = await videoDuration(url);
      // A quarter-second of slack: a clip trimmed to "6 seconds" on a phone is
      // rarely 6.000, and refusing 6.02 would read as a bug.
      if (seconds === 0 || seconds > LIVE_MAX_SECONDS + 0.25) {
        URL.revokeObjectURL(url);
        setError(
          seconds === 0
            ? "Couldn't read that clip."
            : `A live photo can be up to ${LIVE_MAX_SECONDS} seconds — that one is ${Math.round(seconds)}. New video handles anything longer.`,
        );
        return;
      }
      ownedUrls.current.push(url);
      addPhotos([{ blob: clip, url, remote: false, kind: "live" }]);
      return;
    }

    if (hasLive) {
      setError("Remove the live photo first — a post is one or the other.");
      return;
    }

    const added: { blob: Blob; url: string; remote: boolean }[] = [];
    for (const file of stills) {
      // HEIC is accepted here and decodes natively on iOS — the export canvas
      // re-encodes to JPEG anyway.
      const url = URL.createObjectURL(file);
      ownedUrls.current.push(url);
      added.push({ blob: file, url, remote: false });
    }
    addPhotos(added);
  }

  function handleAudioFile(files: FileList | null) {
    const file = files?.[0];
    // Cleared before the early return as well: leaving the same file selected
    // means picking it again after removing it fires no change event.
    if (audioInputRef.current) audioInputRef.current.value = "";
    if (!file || !file.type.startsWith("audio/")) return;
    const url = URL.createObjectURL(file);
    ownedUrls.current.push(url);
    setSound({ blob: file, url, name: soundLabel(file.name) });
  }

  function removeSound() {
    audioElRef.current?.pause();
    // The URL stays in ownedUrls and is freed with the session. Revoking it
    // here would break a re-pick of the same file, and the session's diff-aware
    // park is the one place that knows what is still referenced.
    setSound(null);
  }

  /** Audition the track in the editor. Nothing is mixed, so this is the only
   *  way to hear what the post will sound like before it goes out. */
  function toggleAudition() {
    const el = audioElRef.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => setAuditioning(false));
    else el.pause();
  }

  // Whatever this screen was opened with. Two producers, both handing over an
  // ordinary item so it measures and edits like any other:
  //
  //   - the camera, when the shutter was HELD in Photo mode — that records a
  //     short silent clip and routes here rather than to the after-shot
  //     screen, because a live photo is a photo-editor product;
  //   - a draft tapped on the drafts page.
  const intakeDone = useRef(false);
  useEffect(() => {
    if (intakeDone.current) return;
    intakeDone.current = true;

    const capture = takePendingCapture();
    if (capture) {
      // Ownership of the URL moves to the session here, so it survives the
      // trip to publish and back.
      ownedUrls.current.push(capture.url);
      addPhotos([
        {
          blob: capture.blob,
          url: capture.url,
          remote: false,
          kind: capture.type === "video" ? "live" : "photo",
        },
      ]);
      return;
    }

    const draft = takePendingDraft();
    if (!draft) return;
    addPhotos([{ url: draft.url, remote: true, kind: draft.kind === "video" ? "live" : "photo" }]);
    // The draft's sound comes back with it. Remote for now — the bytes are
    // only fetched if this draft is actually posted, so reopening one to fix a
    // caption doesn't re-download a song.
    if (draft.audioUrl) {
      setSound({ blob: null, url: draft.audioUrl, name: draft.audioName || "Sound" });
    }
    // addPhotos is a plain function redeclared each render; depending on it
    // would re-run this on every keystroke elsewhere in the component.
  }, []);

  function handlePickedUrls(picked: PickedMedia[]) {
    // Photos only here by construction — this editor asks the picker for
    // stills, since a carousel slide can't be a video.
    addPhotos(picked.map((m) => ({ url: m.url, remote: true })));
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

  /** Hold a thumbnail, then drag it. Order is the post: `photos[0]` is the
   *  cover and `handleNext` bakes the array in sequence, so this gesture is
   *  the only thing that decides what the feed shows first.
   *
   *  Three problems have to be solved together, which is why this is hand-
   *  rolled rather than a swap helper behind two buttons:
   *
   *  1. The strip scrolls horizontally, and so does a drag. The hold is what
   *     separates them — move more than a few pixels before it lands and the
   *     gesture is a scroll and stays one.
   *  2. Once the hold HAS landed the browser must be told to stop scrolling,
   *     and `touch-action` can't do it: browsers commit to a touch action when
   *     the gesture starts, and ours starts as an ordinary press. A
   *     non-passive touchmove listener that preventDefaults is the only thing
   *     that works mid-gesture.
   *  3. A ten-photo carousel is wider than the strip, so the strip has to
   *     scroll itself when the finger reaches an edge — otherwise the photos
   *     you want to reorder past are the ones you can't reach. */
  function startTileGesture(e: React.PointerEvent<HTMLButtonElement>, id: string) {
    if (photos.length < 2) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const strip = stripRef.current;
    const startScroll = strip?.scrollLeft ?? 0;
    let holdTimer: number | null = window.setTimeout(() => {
      holdTimer = null;
      dragging = true;
      dragDxRef.current = 0;
      setDragId(id);
      setDragDx(0);
      window.addEventListener("touchmove", block, { passive: false });
    }, HOLD_MS);
    let dragging = false;

    const block = (ev: TouchEvent) => ev.preventDefault();

    const update = (clientX: number) => {
      // Scroll delta is added back in: without it, auto-scrolling the strip
      // would slide the tile out from under the finger holding it.
      const scrolled = (stripRef.current?.scrollLeft ?? 0) - startScroll;
      const dx = clientX - startX + scrolled;
      dragDxRef.current = dx;
      setDragDx(dx);
    };

    const onMove = (ev: PointerEvent) => {
      if (!dragging) {
        if (
          Math.abs(ev.clientX - startX) > HOLD_SLOP ||
          Math.abs(ev.clientY - startY) > HOLD_SLOP
        ) {
          cleanup();
        }
        return;
      }
      pointerXRef.current = ev.clientX;
      update(ev.clientX);
      runAutoScroll();
    };

    const runAutoScroll = () => {
      if (autoScrollRef.current !== null) return;
      const step = () => {
        const el = stripRef.current;
        if (!el || !dragging) {
          autoScrollRef.current = null;
          return;
        }
        const box = el.getBoundingClientRect();
        const x = pointerXRef.current;
        let delta = 0;
        if (x < box.left + EDGE_ZONE) delta = -EDGE_SPEED;
        else if (x > box.right - EDGE_ZONE) delta = EDGE_SPEED;
        if (delta !== 0) {
          const before = el.scrollLeft;
          el.scrollLeft = before + delta;
          if (el.scrollLeft !== before) update(x);
        }
        autoScrollRef.current = requestAnimationFrame(step);
      };
      autoScrollRef.current = requestAnimationFrame(step);
    };

    const onUp = () => {
      if (dragging) {
        const from = photos.findIndex((p) => p.id === id);
        const to = clampIndex(from + Math.round(dragDxRef.current / DRAG_STRIDE), photos.length);
        if (from >= 0 && to !== from) {
          setPhotos((prev) => {
            const next = [...prev];
            const [moved] = next.splice(from, 1);
            next.splice(to, 0, moved);
            return next;
          });
        }
      }
      cleanup();
    };

    const cleanup = () => {
      if (holdTimer !== null) clearTimeout(holdTimer);
      dragging = false;
      if (autoScrollRef.current !== null) {
        cancelAnimationFrame(autoScrollRef.current);
        autoScrollRef.current = null;
      }
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("touchmove", block);
      dragDxRef.current = 0;
      setDragId(null);
      setDragDx(0);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  function removeActive() {
    if (!activeId) return;
    delete layersByPhoto.current[activeId];
    setPhotos((prev) => {
      const next = prev.filter((p) => p.id !== activeId);
      setActiveId(next[0]?.id ?? null);
      return next;
    });
  }

  const handleLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const w = e.currentTarget.naturalWidth;
      const h = e.currentTarget.naturalHeight;
      patchActive({ naturalSize: { w, h }, aspect: w / h });
    },
    [patchActive],
  );

  /** The same measurement for a live photo. A clip's intrinsic size lives on
   *  different properties than an image's, and every downstream calculation —
   *  crop, fitted preview, layer coordinates — reads `naturalSize`, so this
   *  has to fill in the identical field. */
  const handleVideoLoad = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      const w = e.currentTarget.videoWidth;
      const h = e.currentTarget.videoHeight;
      if (!w || !h) return;
      patchActive({ naturalSize: { w, h }, aspect: w / h });
    },
    [patchActive],
  );

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

  // Preview geometry — identical maths to the after-shot screen, which is what
  // keeps a crop looking the same on both.
  const effectiveAspect =
    active?.crop && active.naturalSize
      ? (active.crop.w * active.naturalSize.w) / (active.crop.h * active.naturalSize.h)
      : (active?.aspect ?? 1);
  const fitted = useFittedSize(mediaAreaRef, effectiveAspect);

  const previewingFilter =
    previewFilterId != null ? (CAMERA_FILTERS.find((f) => f.id === previewFilterId) ?? null) : null;
  const committedFilter =
    CAMERA_FILTERS.find((f) => f.id === active?.filterId) ?? CAMERA_FILTERS[0];
  const shownFilter = previewingFilter ?? committedFilter;
  const shownIntensity = previewFilterIntensity ?? active?.filterIntensity ?? 100;

  const previewCss = useMemo(() => {
    const base = previewCssAtIntensity(shownFilter, shownIntensity);
    const adj = adjustToCss(active?.adjust ?? NEUTRAL_ADJUST);
    const parts = [base === "none" ? "" : base, adj].filter(Boolean);
    return parts.length ? parts.join(" ") : "none";
  }, [shownFilter, shownIntensity, active?.adjust]);

  const mediaStyle = useCallback((): React.CSSProperties => {
    const crop = active?.crop;
    const nat = active?.naturalSize;
    if (!crop || !nat || !fitted.width || !fitted.height) {
      return { filter: previewCss };
    }
    const scale = fitted.width / (crop.w * nat.w);
    return {
      position: "absolute",
      left: -(crop.x * nat.w * scale),
      top: -(crop.y * nat.h * scale),
      width: nat.w * scale,
      height: nat.h * scale,
      maxWidth: "none",
      filter: previewCss,
    };
  }, [active?.crop, active?.naturalSize, fitted.width, fitted.height, previewCss]);

  /** Bakes ONE photo. Same single composite pass the after-shot screen uses —
   *  crop, then grade + adjustments, then layers — so nothing here re-encodes
   *  twice however many tools were touched. */
  const bake = useCallback(
    async (
      photo: EditPhoto,
      photoLayers: Layer[],
      onProgress?: (ratio: number) => void,
    ): Promise<Blob> => {
      let blob = photo.blob;
      if (photo.remote || blob.size === 0) {
        const res = await fetch(photo.url);
        if (!res.ok) throw new Error("Couldn't load that image");
        blob = await res.blob();
      }
      const filter = CAMERA_FILTERS.find((f) => f.id === photo.filterId) ?? CAMERA_FILTERS[0];
      const adjustCss = adjustToCss(photo.adjust);

      // A live photo is a clip, so it composites through the video encoder —
      // the same filter, layers and crop, one pass, via the shared branch in
      // after-shot-export. exportComposite rather than exportVideo directly,
      // for its short-circuit: a live photo nobody edited comes back as the
      // bytes that went in, with no second generation of compression spent on
      // applying nothing.
      if (photo.kind === "live") {
        return exportComposite(
          { type: "video", blob, url: photo.url },
          filter,
          photo.filterIntensity,
          photoLayers,
          photo.crop,
          onProgress,
          adjustCss,
        );
      }
      return exportPhoto(blob, filter, photo.filterIntensity, photoLayers, photo.crop, adjustCss);
    },
    [],
  );

  /** The current stack for a photo — live state for the selected one, parked
   *  state for the rest. */
  const layersFor = useCallback(
    (photo: EditPhoto) =>
      photo.id === activeId ? layers : (layersByPhoto.current[photo.id] ?? []),
    [activeId, layers],
  );

  async function handleSave() {
    if (!active) return;
    setError(null);
    setBusy("Saving…");
    try {
      const blob = await bake(active, layersFor(active), (r) =>
        setBusy(`Saving… ${Math.round(r * 100)}%`),
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `oakmonte-${Date.now()}.${active.kind === "live" ? "mp4" : "jpg"}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Long enough for the browser to have started the download.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (err) {
      console.error("PhotoEditor: save failed", err);
      setError(err instanceof Error ? err.message : "Couldn't save that image");
    } finally {
      setBusy(null);
    }
  }

  async function handleNext() {
    if (photos.length === 0) return;
    setError(null);
    setBusy("Preparing…");
    // Nothing about leaving this screen should keep playing on the next one.
    audioElRef.current?.pause();
    try {
      // Every photo goes forward, each baked with its own edit stack. The
      // first is the cover; the rest ride along as `extra` and become the
      // carousel's remaining items. Baked one at a time rather than in
      // parallel — each bake is a full-resolution canvas composite, and a
      // phone doing five at once is a phone that drops the tab.
      const baked: { type: "photo" | "video"; blob: Blob; url: string }[] = [];
      for (const [i, photo] of photos.entries()) {
        const label = photos.length > 1 ? `Preparing ${i + 1} of ${photos.length}` : "Preparing";
        setBusy(`${label}…`);
        const blob = await bake(photo, layersFor(photo), (r) =>
          // Only the live path reports progress, and only it needs to: a clip
          // takes long enough that a static "Preparing…" reads as a hang.
          setBusy(`${label}… ${Math.round(r * 100)}%`),
        );
        baked.push({
          // A live photo is a video file. Everything downstream — the upload's
          // mediaTypes array, post_media.media_type, the feed's <video> — reads
          // this, and calling it a photo would produce an MP4 named .jpg.
          type: photo.kind === "live" ? "video" : "photo",
          blob,
          url: URL.createObjectURL(blob),
        });
      }

      // A live photo needs a still. `media_type` is "video", so the profile
      // grid, the media pickers and the drafts page all reach for a thumbnail,
      // and without one they each fall back to decoding the clip themselves.
      let poster: { blob: Blob; url: string } | undefined;
      if (photos[0].kind === "live") {
        try {
          const shot = await videoThumbnail(baked[0].url, 0.1);
          const res = await fetch(shot.url);
          poster = { blob: await res.blob(), url: shot.url };
        } catch (err) {
          // Not worth failing the post over — the cover just falls back to
          // whatever each screen does with a posterless clip today.
          console.warn("PhotoEditor: couldn't grab a poster for the live photo", err);
        }
      }

      // The track goes as bytes, like everything else in the handoff. A sound
      // restored from a draft is still only a URL at this point, so that is
      // the one case that has to fetch.
      let audio: { blob: Blob; url: string; name: string } | undefined;
      if (sound) {
        setBusy("Preparing sound…");
        let blob = sound.blob;
        if (!blob) {
          const res = await fetch(sound.url);
          if (!res.ok) throw new Error("Couldn't load that sound");
          blob = await res.blob();
        }
        audio = { blob, url: sound.url, name: sound.name };
      }

      setPendingCapture({
        ...baked[0],
        origin: "photo-editor",
        extra: baked.slice(1),
        audio,
        poster,
      });
      // Straight to publish. This used to detour through the after-shot
      // editor, which meant a second editing screen for something already
      // edited; the one tool that detour added — Draw — is in this screen's
      // own toolbar now. The unmount cleanup parks the carousel, so backing
      // out of publish returns to it.
      await navigate({ to: "/create/after-shot/publish" });
    } catch (err) {
      console.error("PhotoEditor: next failed", err);
      setError(err instanceof Error ? err.message : "Couldn't prepare that image");
    } finally {
      setBusy(null);
    }
  }

  const closeTool = useCallback(() => setActiveTool(null), []);
  const empty = photos.length === 0;

  return (
    <div
      className="fixed inset-0 bg-black text-white overflow-hidden"
      style={{ fontFamily: "'SF Pro', system-ui, sans-serif" }}
    >
      {/* Header. Sits above everything and stays put — it's the only way out. */}
      {activeTool === null && (
        <div
          className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}
        >
          <button
            type="button"
            onClick={() => {
              // Leaving on purpose ends the edit, so the parked carousel goes
              // with it — otherwise the next Photo editor would open onto the
              // photos you just walked away from.
              discardPhotoEditorSession();
              void navigate({ to: "/create", search: { tab: "create" } });
            }}
            aria-label="Back"
            className="flex h-10 w-10 items-center justify-center active:scale-90"
          >
            <ChevronLeft size={24} />
          </button>
          <span className="text-[15px] font-semibold">Photo editor</span>
          <button
            type="button"
            aria-label="Settings"
            className="flex h-10 w-10 items-center justify-center text-white/80 active:scale-90"
          >
            <Settings size={20} />
          </button>
        </div>
      )}

      {/* Media area */}
      <div
        ref={mediaAreaRef}
        className="absolute left-0 right-0 flex items-center justify-center"
        // Measured, not a constant. This used to be a hard 210px, which was
        // right for the stack it was written against — then the sound chip and
        // the reorder hint arrived and the stack grew past it, and the bottom
        // of the photo went under the controls. Measuring means adding another
        // row can't quietly cost the preview its bottom edge.
        style={{ top: "calc(env(safe-area-inset-top) + 64px)", bottom: bottomInset }}
      >
        {empty ? (
          // Nothing added yet: the plus IS the screen. Same three sources the
          // product form offers, so "upload from drafts" means the same thing
          // in both places.
          <button
            type="button"
            onClick={openSource}
            className="flex flex-col items-center gap-3 active:scale-95"
          >
            <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full border border-white/25 bg-white/[0.06]">
              <Plus size={34} />
            </span>
            <span className="text-[13px] text-white/50">Add photos</span>
            {/* The one thing about this screen nobody would guess: it takes a
                short clip too. */}
            <span className="max-w-[220px] text-center text-[11px] leading-snug text-white/35">
              Several make a carousel. A clip up to {LIVE_MAX_SECONDS}s becomes a live photo.
            </span>
          </button>
        ) : (
          active && (
            <div
              ref={mediaBoxRef}
              className="relative overflow-hidden"
              style={{
                width: fitted.width || undefined,
                height: fitted.height || undefined,
                background: "#000",
              }}
            >
              {active.kind === "live" ? (
                // Looping, muted, autoplaying: a live photo is judged by how
                // it moves, so the preview has to move too. Muted because the
                // capture path records no audio in Photo mode and the feed
                // mutes media regardless — a sound is a separate track.
                <video
                  key={active.id}
                  src={active.url}
                  crossOrigin={active.remote ? "anonymous" : undefined}
                  onLoadedMetadata={handleVideoLoad}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className={active.crop ? "" : "absolute inset-0 h-full w-full object-cover"}
                  style={mediaStyle()}
                />
              ) : (
                <img
                  key={active.id}
                  src={active.url}
                  alt=""
                  crossOrigin={active.remote ? "anonymous" : undefined}
                  onLoad={handleLoad}
                  className={active.crop ? "" : "absolute inset-0 h-full w-full object-cover"}
                  style={mediaStyle()}
                />
              )}

              {(activeTool === null || activeTool === "text") && (
                <div
                  className="absolute inset-0"
                  style={{ pointerEvents: activeTool === null ? undefined : "none" }}
                >
                  <LayerOverlay
                    containerRef={mediaBoxRef}
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
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70">
                  <span className="text-[12px] uppercase tracking-widest">{busy}</span>
                </div>
              )}
            </div>
          )
        )}
      </div>

      {/* Crop and Text live outside the media box so their controls anchor to
          the screen rather than to a letterboxed media edge. */}
      {active && (
        <CropPanel
          open={activeTool === "crop"}
          containerRef={mediaBoxRef}
          naturalSize={active.naturalSize}
          cropRect={active.crop}
          onCropChange={(crop) => patchActive({ crop })}
          onClose={closeTool}
        />
      )}

      <TextPanel
        open={activeTool === "text"}
        containerRef={mediaBoxRef}
        editingLayerId={editingLayerId}
        onClose={() => {
          setEditingLayerId(null);
          closeTool();
        }}
      />

      <DrawPanel open={activeTool === "draw"} containerRef={mediaBoxRef} onClose={closeTool} />

      <FilterPanel
        open={activeTool === "filter"}
        selectedId={active?.filterId ?? DEFAULT_FILTER_ID}
        intensity={active?.filterIntensity ?? 100}
        favoriteIds={favoritedFilterIds}
        onClose={closeTool}
        onPreview={(id, intensity) => {
          setPreviewFilterId(id);
          setPreviewFilterIntensity(intensity);
        }}
        onApply={(id, intensity) => {
          patchActive({ filterId: id, filterIntensity: intensity });
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
        value={active?.adjust ?? NEUTRAL_ADJUST}
        onChange={(adjust) => patchActive({ adjust })}
        onClose={closeTool}
      />

      {/* Bottom stack: carousel strip, tool row, actions. Hidden whenever a
          tool owns the screen. */}
      {activeTool === null && (
        <div
          ref={bottomStackRef}
          className="absolute inset-x-0 bottom-0 z-20"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
        >
          {/* The chosen track. A chip rather than a panel: there is one
              setting here — which song — and a whole screen to hold it would
              be a screen you have to leave to see whether it worked. */}
          {!empty && sound && (
            <div className="flex justify-center px-4 pb-2.5">
              <div className="flex max-w-full items-center gap-2 rounded-full bg-white/[0.14] py-1.5 pl-3 pr-1.5">
                <Music size={13} className="shrink-0 text-white/70" />
                <span className="truncate text-[12px]">{sound.name}</span>
                <button
                  type="button"
                  onClick={toggleAudition}
                  aria-label={auditioning ? "Pause sound" : "Play sound"}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15 active:scale-90"
                >
                  {auditioning ? (
                    <Pause size={11} fill="currentColor" strokeWidth={0} />
                  ) : (
                    <Play size={11} fill="currentColor" strokeWidth={0} className="ml-[1px]" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={removeSound}
                  aria-label="Remove sound"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15 text-white/70 active:scale-90"
                >
                  <X size={11} />
                </button>
              </div>
            </div>
          )}

          {/* The carousel strip, and the controls that act on the selected
              photo. The thumbnails scroll; the buttons do NOT — they sit
              outside the scroller so reorder and delete can't slide off the
              edge of a six-photo carousel, which is exactly when you need
              them. */}
          {!empty && (
            <div className="flex items-center gap-2 px-4 pb-3">
              <div
                ref={stripRef}
                className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-1"
                style={{ scrollbarWidth: "none" }}
              >
                {photos.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    data-photo-id={p.id}
                    onPointerDown={(e) => startTileGesture(e, p.id)}
                    onClick={() => setActiveId(p.id)}
                    aria-label={i === 0 ? "Select cover photo" : `Select photo ${i + 1}`}
                    aria-pressed={p.id === activeId}
                    style={{
                      transform: `translateX(${tileShift(i)}px)${i === dragIndex ? " scale(1.12)" : ""}`,
                      // The dragged tile tracks the finger with no easing —
                      // anything else reads as lag. The tiles moving aside are
                      // the ones that need the animation.
                      transition: i === dragIndex ? "none" : "transform 160ms ease",
                      zIndex: i === dragIndex ? 10 : undefined,
                      boxShadow: i === dragIndex ? "0 8px 20px rgba(0,0,0,0.55)" : undefined,
                    }}
                    className={`relative h-[46px] w-[46px] shrink-0 overflow-hidden rounded-[6px] border-2 transition-colors ${
                      p.id === activeId ? "border-white" : "border-transparent opacity-60"
                    }`}
                  >
                    {p.kind === "live" ? (
                      <video
                        src={p.url}
                        muted
                        playsInline
                        preload="metadata"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <img src={p.url} alt="" className="h-full w-full object-cover" />
                    )}
                    {/* Order is not decoration: the first photo is the cover,
                        and the cover is what the whole feed judges the post by.
                        Saying so on the tile is what makes the arrows worth
                        reaching for. */}
                    {i === 0 && photos.length > 1 && (
                      <span className="absolute inset-x-0 bottom-0 bg-black/65 text-[8px] font-semibold leading-[12px] text-white">
                        Cover
                      </span>
                    )}
                  </button>
                ))}
                {/* No plus beside a live photo: there is nothing it could add
                    that the post is allowed to hold. Hiding it beats letting the
                    tap through to an error message. */}
                {!hasLive && (
                  <button
                    type="button"
                    onClick={openSource}
                    aria-label="Add photos"
                    className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[6px] bg-white/[0.12] active:scale-90"
                  >
                    <Plus size={20} />
                  </button>
                )}
              </div>

              {(photos.length > 1 || hasLive) && (
                <button
                  type="button"
                  onClick={removeActive}
                  aria-label="Remove this photo"
                  className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[6px] bg-white/[0.12] text-white/70 active:scale-90"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          )}

          {/* A hold is invisible until someone tells you it's there. Shown only
              while it can do something, and it goes quiet during the drag
              itself — by then you already know. */}
          {photos.length > 1 && !dragId && (
            <p className="px-4 pb-2 text-center text-[10px] text-white/35">
              Hold a photo to reorder. The first one is your cover.
            </p>
          )}

          <div
            className="flex items-start gap-1 overflow-x-auto px-3 pb-4"
            style={{ scrollbarWidth: "none" }}
          >
            {TOOLS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                disabled={empty}
                onClick={() => {
                  if (id === "sticker") stickerInputRef.current?.click();
                  else setActiveTool(id);
                }}
                className="flex w-[68px] shrink-0 flex-col items-center gap-1.5 py-1 active:scale-90 disabled:opacity-30"
              >
                <Icon size={23} strokeWidth={1.6} />
                <span className="text-[11px] leading-tight">{label}</span>
              </button>
            ))}
            {/* Outside TOOLS, like Save, because it opens the file picker
                instead of taking over the screen with a panel. */}
            <button
              type="button"
              disabled={empty}
              onClick={() => audioInputRef.current?.click()}
              className="flex w-[68px] shrink-0 flex-col items-center gap-1.5 py-1 active:scale-90 disabled:opacity-30"
            >
              <Music size={23} strokeWidth={1.6} />
              <span className="text-[11px] leading-tight">{sound ? "Change" : "Sound"}</span>
            </button>
            <button
              type="button"
              disabled={empty}
              onClick={() => void handleSave()}
              className="flex w-[68px] shrink-0 flex-col items-center gap-1.5 py-1 active:scale-90 disabled:opacity-30"
            >
              <Download size={23} strokeWidth={1.6} />
              <span className="text-[11px] leading-tight">Save</span>
            </button>
          </div>

          {error && (
            <div className="mx-4 mb-3 rounded-xl bg-black/80 px-4 py-2.5">
              <p className="text-[12px] text-red-300">{error}</p>
            </div>
          )}

          <div className="px-4">
            <button
              type="button"
              disabled={empty || !!busy}
              onClick={() => void handleNext()}
              className="w-full rounded-full bg-[var(--oak-action)] py-3.5 text-[15px] font-semibold text-white active:scale-[0.98] disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,image/heic,image/heif,video/*"
        multiple
        className="hidden"
        onChange={(e) => void handleDeviceFiles(e.target.files)}
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
        onChange={(e) => handleAudioFile(e.target.files)}
      />

      {/* The audition player. Looped, because the track is longer than the
          post and hearing where it restarts is the point. `auditioning` is
          driven by the element's own events rather than set alongside the
          play() call, so an autoplay rejection or a track ending can't leave
          the chip showing a pause button over silence. */}
      {sound && (
        <audio
          ref={audioElRef}
          src={sound.url}
          loop
          onPlay={() => setAuditioning(true)}
          onPause={() => setAuditioning(false)}
        />
      )}

      {sourceOpen && (
        <ImageSourceSheet
          anchorRect={sourceAnchor}
          onSelect={chooseSource}
          onClose={() => setSourceOpen(false)}
        />
      )}
      {draftsOpen && (
        <DraftImagePickerSheet onSelect={handlePickedUrls} onClose={() => setDraftsOpen(false)} />
      )}
      {postsOpen && (
        <PostImagePickerSheet onSelect={handlePickedUrls} onClose={() => setPostsOpen(false)} />
      )}
    </div>
  );
}
