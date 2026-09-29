import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  X,
  Type,
  Pencil,
  Sticker,
  Volume2,
  VolumeX,
  Blend,
  Crop,
  Clapperboard,
  Music,
  Pause,
  Play,
  SlidersHorizontal,
} from "lucide-react";
import { NO_EDITS, useAfterShotContext } from "@/lib/after-shot-context";
import SoundLibrarySheet from "@/components/camera/SoundLibrarySheet";
import { type LibraryTrack, creditFor } from "@/lib/sound-library";
import TextPanel from "@/components/camera/aftershot/TextPanel";
import CropPanel from "@/components/camera/aftershot/CropPanel";
import DrawPanel from "@/components/camera/aftershot/DrawPanel";
import FilterPanel, { PANEL_HEIGHT as FILTER_PANEL_HEIGHT } from "@/components/camera/FilterPanel";
import PhotoAdjustPanel from "@/components/create/PhotoAdjustPanel";
import { CAMERA_FILTERS, previewCssAtIntensity } from "@/components/camera/filter-data";
import { adjustToCss, type PhotoAdjust } from "@/lib/photo-adjust";
import { vignetteCss } from "@/lib/vignette";
import { exportComposite } from "@/lib/after-shot-export";
import type { CropRect } from "@/lib/crop-rect";
import LayerOverlay from "@/components/camera/LayerOverlay";
import { useAfterShotLayers, type Layer } from "@/lib/after-shot-layers";
import { useLayerRenderer } from "@/components/camera/aftershot/use-layer-renderer";
import { useLockedViewport } from "@/hooks/use-locked-viewport";
import { useFittedSize } from "@/hooks/use-fitted-size";
import { GLASS_RIM, glassClear } from "@/lib/liquid-glass";
import ConfirmDiscard from "@/components/editor/ConfirmDiscard";
import { HintBubble } from "@/components/editor/OneTimeHint";
import { useOneTimeHint } from "@/hooks/use-one-time-hint";

export const Route = createFileRoute("/create/after-shot/")({
  head: () => ({ meta: [{ title: "Edit — Oakmonte" }] }),
  component: AfterShotIndexPage,
});

// No "link" here. Products are linked on the publish screen, which is the one
// place that knows which of your products exist — this toolbar's Link button
// was a second entry point that had never been wired to anything.
type ToolId = "crop" | "text" | "draw" | "filter" | "sound" | "sticker" | "adjust";

const EDIT_TOOLS: { id: ToolId; label: string; icon: typeof Type }[] = [
  { id: "text", label: "Text", icon: Type },
  { id: "draw", label: "Draw", icon: Pencil },
  { id: "sticker", label: "Stickers", icon: Sticker },
  // Music, not a speaker: the speaker right next to it in the top bar is the
  // preview's mute toggle, and two volume icons on one screen meaning
  // different things is a coin flip every time.
  { id: "sound", label: "Sound", icon: Music },
  { id: "filter", label: "Filters", icon: Blend },
  { id: "adjust", label: "Adjust", icon: SlidersHorizontal },
  // Crop used to sit alone behind an unlabelled "more" chevron. Seven labelled
  // tools fit the rail on the smallest phone we support, and a tool nobody can
  // find is a tool nobody has.
  { id: "crop", label: "Crop", icon: Crop },
];

function AfterShotIndexPage() {
  useLockedViewport();
  const navigate = useNavigate();
  const { media, setMedia, discard, edits, setEdits, output, setOutput } = useAfterShotContext();

  const mediaBoxRef = useRef<HTMLDivElement>(null);
  const mediaAreaRef = useRef<HTMLDivElement>(null);
  const {
    layers,
    addLayer,
    updateLayer,
    removeLayer,
    replaceLayers,
    selectedLayerId,
    setSelectedLayerId,
  } = useAfterShotLayers();
  const renderLayerContent = useLayerRenderer(mediaBoxRef);

  const [mediaAspect, setMediaAspect] = useState(9 / 16);
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);
  // Measured from PhotoAdjustPanel's actual rendered height (it's
  // deliberately content-sized, not fixed — see its own doc) so the reserved
  // preview space always matches reality instead of a static guess drifting
  // out of sync with it. Starts at a safe upper-bound estimate for the first
  // paint, before the panel has mounted and reported its real height.
  const [adjustPanelHeight, setAdjustPanelHeight] = useState(480);
  // Captured video autoplays muted because that's the only way a browser will
  // autoplay it at all — the toggle is what gets the sound back.
  const [videoMuted, setVideoMuted] = useState(true);

  // Owned once, here, from the page's own real <img>/<video> load event —
  // this is what CropPanel now receives as a prop instead of loading its
  // own invisible probe element to re-derive the same numbers.
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);

  // The committed crop — fractional, relative to the ORIGINAL untouched
  // media (see crop-rect.ts). CropPanel only ever proposes a new value here;
  // it no longer bakes a crop into media.blob itself. The live preview below
  // simulates the crop with CSS on the still-uncropped media element, and
  // exportComposite bakes it for real, once, alongside the filter and layers.
  const cropRect = edits.cropRect;
  const setCropRect = useCallback(
    (next: CropRect | null) => setEdits((e) => ({ ...e, cropRect: next })),
    [setEdits],
  );

  // Filters stay a quick pick-one-and-apply interaction (matching
  // FilterPanel's existing bottom-sheet shape from create.tsx) rather than
  // an overlay panel like Crop/Text/Draw, since there's nothing to place or
  // drag — just re-encoding the whole frame, same as the old filters route.
  const selectedFilterId = edits.filterId;
  const selectedFilterIntensity = edits.filterIntensity;
  // What the filter list is currently hovering on, before you commit to it.
  // FilterPanel drives this through onPreview and resets it itself on discard.
  const [previewFilterId, setPreviewFilterId] = useState<string | null>(null);
  const [previewFilterIntensity, setPreviewFilterIntensity] = useState<number | null>(null);
  const [favoritedFilterIds, setFavoritedFilterIds] = useState<Set<string>>(new Set());
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);

  // Manual tone adjustments. Neutral (all zeroes) on first open, committed on
  // export alongside the filter so both travel in one canvas pass.
  const adjust = edits.adjust;
  const setAdjust = useCallback(
    (next: PhotoAdjust) => setEdits((e) => ({ ...e, adjust: next })),
    [setEdits],
  );

  // Export state — the one place the whole edit stack turns into a file.
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportError, setExportError] = useState<string | null>(null);

  const handlePhotoLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const w = e.currentTarget.naturalWidth;
    const h = e.currentTarget.naturalHeight;
    setMediaAspect(w / h);
    setNaturalSize({ w, h });
  }, []);

  const handleVideoLoad = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const w = e.currentTarget.videoWidth;
    const h = e.currentTarget.videoHeight;
    setMediaAspect(w / h);
    setNaturalSize({ w, h });
  }, []);

  // The box shapes itself to the CROPPED aspect once a crop is committed —
  // same effect as the old eager-bake had (the box re-measured against a
  // genuinely smaller image), just computed instead of re-encoded.
  const effectiveAspect =
    cropRect && naturalSize
      ? (cropRect.w * naturalSize.w) / (cropRect.h * naturalSize.h)
      : mediaAspect;

  // Explicit contain-fit. See use-fitted-size.ts for why CSS alone silently
  // gave the box the SCREEN's aspect instead of the media's.
  const fitted = useFittedSize(mediaAreaRef, effectiveAspect);

  // Simulates the crop on the still-uncropped <img>/<video>: the element is
  // rendered at its full natural size (scaled so the crop rect exactly fills
  // the box) and shifted so the crop's top-left lands at the box's origin —
  // the box's overflow:hidden clips everything outside it. Falls back to
  // today's plain object-cover fill when there's no crop, so the untouched
  // case renders identically to before this existed.
  const mediaStyle = useCallback(
    (filterCss: string): React.CSSProperties => {
      if (!cropRect || !naturalSize || !fitted.width || !fitted.height) {
        return { filter: filterCss };
      }
      const cropPxW = cropRect.w * naturalSize.w;
      const cropPxH = cropRect.h * naturalSize.h;
      const scale = fitted.width / cropPxW;
      return {
        position: "absolute",
        left: -(cropRect.x * naturalSize.w * scale),
        top: -(cropRect.y * naturalSize.h * scale),
        width: naturalSize.w * scale,
        height: naturalSize.h * scale,
        maxWidth: "none",
        filter: filterCss,
      };
    },
    [cropRect, naturalSize, fitted.width, fitted.height],
  );

  const closeTool = useCallback(() => setActiveTool(null), []);

  // Stickers are gallery images, held as object URLs on their layers. The
  // layout's layer provider frees them when the flow ends — not this page,
  // which unmounts on every trip to publish or the studio while the layers
  // (and the need to bake them again) carry on.
  const stickerInputRef = useRef<HTMLInputElement>(null);
  const [soundSheetOpen, setSoundSheetOpen] = useState(false);
  const audioElRef = useRef<HTMLAudioElement>(null);
  const [auditioning, setAuditioning] = useState(false);

  // Sound was in this toolbar with nothing behind it — the button existed and
  // tapping it did nothing. It carries on the captured media rather than in
  // local state so the publish screen, which is the thing that uploads it,
  // reads the same field whichever editor the post came through.

  /** A catalogue track stays a URL rather than becoming bytes — see the same
   *  handler in the photo editor. Nothing is downloaded until the post goes
   *  out, and then it is the server that does it. */
  const handleLibraryTrack = useCallback(
    (track: LibraryTrack) => {
      audioElRef.current?.pause();
      setMedia({
        ...media,
        audio: {
          blob: null,
          url: track.streamUrl,
          name: track.title,
          credit: creditFor(track),
        },
      });
    },
    [media, setMedia],
  );

  const removeSound = useCallback(() => {
    if (!media.audio) return;
    audioElRef.current?.pause();
    const { audio: _dropped, ...rest } = media;
    setMedia(rest);
  }, [media, setMedia]);

  /** Hear it before committing to it — nothing is mixed, so this is the only
   *  chance to find out the track was the wrong one. */
  const toggleAudition = useCallback(() => {
    const el = audioElRef.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => setAuditioning(false));
    else el.pause();
  }, []);

  const handleStickerFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        const url = URL.createObjectURL(file);
        addLayer({
          id: `sticker-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          kind: "sticker",
          // Dropped slightly above centre so it doesn't land exactly on top of a
          // caption you've already placed.
          x: 0.5,
          y: 0.42,
          scale: 1,
          rotation: 0,
          zIndex: 0,
          assetUrl: url,
        });
      }
      // Reset so picking the same file twice still fires a change event.
      if (stickerInputRef.current) stickerInputRef.current.value = "";
    },
    [addLayer],
  );

  // The filter CSS covers colour grade + adjustments. The two are composed here
  // rather than in the media element's style so both appear in one pass and the
  // preview matches the single-pass bake.
  const previewingFilter =
    CAMERA_FILTERS.find((f) => f.id === (previewFilterId ?? selectedFilterId)) ?? CAMERA_FILTERS[0];
  const filterCss = previewCssAtIntensity(
    previewingFilter,
    previewFilterIntensity ?? selectedFilterIntensity,
  );
  const adjustCss = adjustToCss(adjust);
  const previewFilterCss =
    [filterCss !== "none" ? filterCss : "", adjustCss !== "none" ? adjustCss : ""]
      .filter(Boolean)
      .join(" ") || "none";
  const selectedFilter = CAMERA_FILTERS.find((f) => f.id === selectedFilterId) ?? CAMERA_FILTERS[0];

  // Vignette can't be a CSS filter (it's positional). Expose the value so the
  // overlay div below can render a radial-gradient approximation.
  const vignetteValue = adjust.vignette;

  const toggleFilterFavorite = useCallback((id: string) => {
    setFavoritedFilterIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleNext = useCallback(async () => {
    setExporting(true);
    setExportProgress(0);
    setExportError(null);
    try {
      const blob = await exportComposite(
        media,
        selectedFilter,
        selectedFilterIntensity,
        layers,
        cropRect,
        setExportProgress,
        adjust,
      );
      // Same blob back means exportComposite took its no-op fast path, and
      // the source goes out as it is.
      //
      // The composite is an OUTPUT, not a new source. Writing it over `media`
      // is what made Back from publish show the baked file under still-live
      // captions. Spread from `media` so the sound, and the cover frame the
      // studio picked, travel with it — both used to be dropped here, so any
      // filter quietly cost the post its music.
      //
      // A cover the seller picked on publish rides along too. It lives on the
      // old output, and rebuilding the output from `media` would drop it — the
      // tile reverting after Back → Next, with nothing to say why.
      setOutput(
        blob === media.blob
          ? null
          : {
              ...media,
              blob,
              url: URL.createObjectURL(blob),
              poster: output?.poster ?? media.poster,
            },
      );
      navigate({ to: "/create/after-shot/publish" });
    } catch (err) {
      console.error("Export failed:", err);
      setExportError(
        media.type === "video" ? "Couldn't make your video." : "Couldn't save your photo.",
      );
    } finally {
      setExporting(false);
    }
  }, [
    media,
    selectedFilter,
    selectedFilterIntensity,
    layers,
    cropRect,
    adjust,
    output,
    setOutput,
    navigate,
  ]);

  // X throws the capture away, and nothing here is saved anywhere — so once
  // there is something to lose it asks first. An untouched shot still goes
  // straight back to the camera: a quick retake shouldn't cost a second tap.
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const hasWork =
    layers.length > 0 ||
    Boolean(media.audio) ||
    edits.filterId !== NO_EDITS.filterId ||
    edits.cropRect !== null ||
    edits.adjust !== NO_EDITS.adjust;
  const handleDiscard = useCallback(() => {
    if (hasWork) setConfirmDiscard(true);
    else discard();
  }, [hasWork, discard]);

  // Deleting a caption, sticker or drawing is one tap on a small corner
  // button, right beside the handle that scales it. This screen has no undo
  // stack, so a mis-tap there was permanent; a few seconds to take it back
  // costs nothing and doesn't put a dialog in front of a deliberate delete.
  const [undoDelete, setUndoDelete] = useState<{ before: Layer[]; label: string } | null>(null);
  const handleRemoveLayer = useCallback(
    (id: string) => {
      const layer = layers.find((l) => l.id === id);
      if (!layer) return;
      setUndoDelete({
        before: layers,
        label:
          layer.kind === "text"
            ? "Text deleted"
            : layer.kind === "sticker"
              ? "Sticker deleted"
              : "Drawing deleted",
      });
      removeLayer(id);
    },
    [layers, removeLayer],
  );
  useEffect(() => {
    if (!undoDelete) return;
    const timer = window.setTimeout(() => setUndoDelete(null), 5000);
    return () => window.clearTimeout(timer);
  }, [undoDelete]);

  const hasText = layers.some((l) => l.kind === "text");
  const [textHint, dismissTextHint] = useOneTimeHint(
    "after-shot-tap-text",
    hasText && activeTool === null,
  );

  return (
    <div
      className="fixed inset-0 bg-black text-white overflow-hidden"
      style={{ fontFamily: "'SF Pro', system-ui, sans-serif" }}
    >
      {/* The ONE mounted media box for the whole after-shot page — every
          panel (Crop, Text, Draw) draws on top of this same element via
          mediaBoxRef, instead of each rendering its own copy. */}
      {/* Flex-centred with maxHeight rather than top:50% + translateY(-50%).
          Three reasons: a translated ancestor becomes the containing block for
          fixed/absolute descendants (which is what stopped panels anchoring to
          the screen); width:100% alone let tall media overflow the viewport and
          get clipped, so the top and bottom of your own frame were unreachable;
          and the trim screen already fits-to-view, so the same clip used to look
          different on the two screens. This is now "contain" on both.

          When a filter or adjust panel is open the bottom is clamped so the
          preview stays clearly visible above the sheet rather than being
          swallowed by it. */}
      <div
        ref={mediaAreaRef}
        className="absolute inset-x-0 top-0 flex items-center justify-center"
        style={{
          bottom:
            activeTool === "filter"
              ? FILTER_PANEL_HEIGHT
              : activeTool === "adjust"
                ? adjustPanelHeight
                : 0,
        }}
      >
        <div
          ref={mediaBoxRef}
          className="oak-motion-fade relative overflow-hidden"
          style={{
            width: fitted.width || undefined,
            height: fitted.height || undefined,
            background: "#000",
          }}
        >
          {/* The filter is CSS on the media element only. Layers sit in a sibling
            overlay so a caption never gets tinted by the filter underneath it —
            and the exporter composites in that same order. */}
          {media.type === "photo" ? (
            <img
              src={media.url}
              alt="Captured"
              onLoad={handlePhotoLoad}
              className={cropRect ? "" : "absolute inset-0 w-full h-full object-cover"}
              style={mediaStyle(previewFilterCss)}
            />
          ) : (
            <video
              src={media.url}
              autoPlay
              loop
              muted={videoMuted}
              playsInline
              disablePictureInPicture
              disableRemotePlayback
              onLoadedMetadata={handleVideoLoad}
              className={cropRect ? "" : "absolute inset-0 w-full h-full object-cover"}
              style={mediaStyle(previewFilterCss)}
            />
          )}

          {exporting && (
            <div className="oak-motion-fade absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 z-30">
              <span className="text-sm uppercase tracking-widest">
                {media.type === "video"
                  ? `Making your video… ${Math.round(exportProgress * 100)}%`
                  : "Saving your photo…"}
              </span>
              {media.type === "video" && (
                <div className="w-40 h-1 rounded-full overflow-hidden bg-white/25">
                  <div
                    className="h-full bg-white transition-[width] duration-150"
                    style={{ width: `${Math.round(exportProgress * 100)}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {exportError && !exporting && (
            <div
              role="alert"
              className="oak-motion-enter absolute inset-x-4 bottom-4 z-30 flex items-center gap-3 rounded-xl bg-black/80 py-2 pl-4 pr-2"
            >
              <p className="min-w-0 flex-1 text-[13px] text-red-300">{exportError}</p>
              <button
                onClick={() => void handleNext()}
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

          {/* Vignette sits BELOW the layers, because the bake draws it before
              drawLayers — it is part of the picture, not something that dims a
              caption laid on top. Rendered from vignetteCss() rather than a
              gradient written here, so the preview and the export cannot drift
              apart; see src/lib/vignette.ts. */}
          {vignetteValue > 0 && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: vignetteCss(vignetteValue) }}
            />
          )}

          {/* Confirmed layers (text/draw/sticker) always render here, on the
            base page — not just while a panel is open — same as how a
            caption sits on a photo permanently once added.
            It stays mounted (inert) while the Text panel is open too, so your
            drawings and other captions don't vanish the moment you start
            typing; the one layer being edited is hidden because the textarea
            is standing in for it. */}
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
                onRemoveLayer={handleRemoveLayer}
                onLayerTap={(layer) => {
                  setEditingLayerId(layer.id);
                  setActiveTool("text");
                }}
              />
            </div>
          )}

          <DrawPanel open={activeTool === "draw"} containerRef={mediaBoxRef} onClose={closeTool} />
        </div>
      </div>

      {/* Crop and Text both live OUTSIDE the media box so their controls anchor
          to the screen rather than to a letterboxed media edge — Crop measures
          the box and lays its frame over it, Text tracks the keyboard. Draw
          stays inside because its whole surface IS the media box. */}
      <CropPanel
        open={activeTool === "crop"}
        containerRef={mediaBoxRef}
        naturalSize={naturalSize}
        cropRect={cropRect}
        onCropChange={setCropRect}
        onClose={closeTool}
      />

      {/* Gallery picker behind the Stickers tool. Multiple selection is allowed
          because adding three stickers shouldn't mean opening the picker three
          times. */}
      <input
        ref={stickerInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleStickerFiles(e.target.files)}
      />
      <SoundLibrarySheet
        open={soundSheetOpen}
        onClose={() => setSoundSheetOpen(false)}
        onPick={handleLibraryTrack}
      />
      {/* Looped: a track is almost always longer than the post it plays over,
          and `auditioning` is driven by the element's own events so a blocked
          play can't leave the chip showing pause over silence. */}
      {/* `bakedIn` has no separate file — the track is inside the media
          already. Nothing from the video editor reaches this screen today, but
          an `<audio src="">` is a broken element rather than a silent one, so
          the guard is worth more than the line it costs. */}
      {media.audio && !media.audio.bakedIn && (
        <audio
          ref={audioElRef}
          src={media.audio.url}
          loop
          onPlay={() => setAuditioning(true)}
          onPause={() => setAuditioning(false)}
        />
      )}

      <TextPanel
        open={activeTool === "text"}
        containerRef={mediaBoxRef}
        editingLayerId={editingLayerId}
        onClose={closeTool}
      />

      {activeTool === null && (
        <>
          <div className="oak-motion-enter absolute top-0 left-0 right-0 flex items-center gap-3 px-4 pt-[calc(env(safe-area-inset-top)+12px)] z-20">
            <button
              onClick={handleDiscard}
              aria-label="Discard and retake"
              className={`relative oak-motion-control flex items-center justify-center w-11 h-11 rounded-full active:scale-90 ${GLASS_RIM}`}
              style={glassClear}
            >
              <X size={20} />
            </button>

            {media.type === "video" && (
              <button
                onClick={() => setVideoMuted((m) => !m)}
                aria-label={videoMuted ? "Unmute preview" : "Mute preview"}
                aria-pressed={!videoMuted}
                className={`relative oak-motion-control flex items-center justify-center w-11 h-11 rounded-full active:scale-90 ${GLASS_RIM}`}
                style={glassClear}
              >
                {videoMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
            )}

            {/* The chosen track. Beside the other media controls rather than in
                a panel of its own: there is one setting here, and a screen you
                have to leave to check would be worse than the button that used
                to do nothing. */}
            {media.audio && (
              <div
                className={`relative oak-motion-pop flex min-w-0 items-center gap-2 rounded-full py-1.5 pl-3 pr-1.5 ${GLASS_RIM}`}
                style={glassClear}
              >
                <Music size={13} className="shrink-0 opacity-70" />
                <span className="truncate text-[12px]">{media.audio.name}</span>
                <button
                  onClick={toggleAudition}
                  aria-label={auditioning ? "Pause sound" : "Play sound"}
                  className="oak-hit oak-motion-control flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/15 active:scale-90"
                >
                  {auditioning ? (
                    <Pause size={11} fill="currentColor" strokeWidth={0} />
                  ) : (
                    <Play size={11} fill="currentColor" strokeWidth={0} className="ml-[1px]" />
                  )}
                </button>
                <button
                  onClick={removeSound}
                  aria-label="Remove sound"
                  className="oak-hit oak-motion-control flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/15 opacity-70 active:scale-90"
                >
                  <X size={11} />
                </button>
              </div>
            )}
          </div>

          {/* Every tool says its name. The rail used to be bare icons, which
              left people guessing what the difference between Filters and
              Adjust was, or that a clapperboard meant "more than one clip". */}
          <div
            className="oak-motion-enter absolute right-3 flex flex-col items-end gap-1 z-20 oak-on-media"
            style={{ top: "calc(env(safe-area-inset-top) + 68px)" }}
          >
            {media.type === "video" && (
              // A clapperboard, not the old scissors: what sits behind this is a
              // multi-clip editor, and an icon that still says "trim" undersells
              // it to the point that people won't open it.
              <RailButton
                label="Edit clips"
                icon={Clapperboard}
                onClick={() => navigate({ to: "/create/after-shot/studio" })}
              />
            )}

            {EDIT_TOOLS.map((tool) => (
              <RailButton
                key={tool.id}
                label={tool.label}
                icon={tool.icon}
                onClick={() => {
                  if (tool.id === "text") {
                    setEditingLayerId(null);
                    setActiveTool("text");
                  } else if (tool.id === "sticker") stickerInputRef.current?.click();
                  else if (tool.id === "sound") setSoundSheetOpen(true);
                  else setActiveTool(tool.id);
                }}
              />
            ))}
          </div>

          {undoDelete && (
            <div
              className="absolute inset-x-0 z-30 flex justify-center px-4"
              style={{ bottom: "calc(env(safe-area-inset-bottom) + 80px)" }}
            >
              <div
                role="status"
                className="oak-motion-pop flex items-center gap-3 rounded-full bg-black/85 py-1 pl-4 pr-1 text-[13px] font-medium text-white"
              >
                {undoDelete.label}
                <button
                  onClick={() => {
                    replaceLayers(undoDelete.before);
                    setUndoDelete(null);
                  }}
                  className="h-9 rounded-full bg-white px-4 text-[13px] font-semibold text-black active:scale-95"
                >
                  Undo
                </button>
              </div>
            </div>
          )}

          {textHint && !undoDelete && (
            <div
              className="absolute inset-x-0 z-20 flex justify-center px-4"
              style={{ bottom: "calc(env(safe-area-inset-bottom) + 80px)" }}
            >
              <HintBubble onDismiss={dismissTextHint}>
                Tap text to edit it, drag to move it
              </HintBubble>
            </div>
          )}

          <div
            className="oak-motion-enter absolute left-0 right-0 flex items-center justify-end px-5 z-20"
            style={{ bottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
          >
            <button
              onClick={handleNext}
              disabled={exporting}
              className="oak-motion-control px-6 py-2.5 rounded-full font-bold text-sm uppercase tracking-wide disabled:opacity-50 active:scale-95"
              style={{ background: "var(--oak-action)", color: "#fff" }}
            >
              Next
            </button>
          </div>
        </>
      )}

      {/* Filters reuses the same bottom-sheet FilterPanel component
          create.tsx already uses — no separate CropPanel-style overlay
          needed since there's nothing to place/drag. */}
      <FilterPanel
        open={activeTool === "filter"}
        selectedId={selectedFilterId}
        intensity={selectedFilterIntensity}
        favoriteIds={favoritedFilterIds}
        onClose={closeTool}
        onPreview={(id, intensity) => {
          setPreviewFilterId(id);
          setPreviewFilterIntensity(intensity);
        }}
        onApply={(id, intensity) => {
          setEdits((e) => ({ ...e, filterId: id, filterIntensity: intensity }));
          setPreviewFilterId(null);
          setPreviewFilterIntensity(null);
        }}
        onToggleFavorite={toggleFilterFavorite}
      />

      <PhotoAdjustPanel
        open={activeTool === "adjust"}
        value={adjust}
        onChange={setAdjust}
        onClose={closeTool}
        onHeightChange={setAdjustPanelHeight}
      />

      {confirmDiscard && (
        <ConfirmDiscard
          message={
            media.type === "video"
              ? "Discard this video and your edits?"
              : "Discard this photo and your edits?"
          }
          onKeep={() => setConfirmDiscard(false)}
          onDiscard={discard}
        />
      )}
    </div>
  );
}

function RailButton({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: typeof Type;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="oak-motion-control flex h-11 items-center gap-2.5 pl-2 opacity-95 active:scale-95"
    >
      {/* A heavier shadow than oak-on-media's: thin 12px type vanishes over a
          white shirt where a 24px glyph still holds. */}
      <span className="text-[12px] font-semibold leading-none [text-shadow:0_0_2px_rgba(0,0,0,0.7),0_1px_4px_rgba(0,0,0,0.6)]">
        {label}
      </span>
      <span className="flex w-7 justify-center">
        <Icon size={24} />
      </span>
    </button>
  );
}
