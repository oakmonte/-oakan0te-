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
  Link2,
  Crop,
  ChevronDown,
  ChevronUp,
  Clapperboard,
} from "lucide-react";
import { useAfterShotContext } from "@/lib/after-shot-context";
import TextPanel from "@/components/camera/aftershot/TextPanel";
import CropPanel from "@/components/camera/aftershot/CropPanel";
import DrawPanel from "@/components/camera/aftershot/DrawPanel";
import FilterPanel from "@/components/camera/FilterPanel";
import { CAMERA_FILTERS } from "@/components/camera/filter-data";
import { exportComposite } from "@/lib/after-shot-export";
import LayerOverlay from "@/components/camera/LayerOverlay";
import { useAfterShotLayers } from "@/lib/after-shot-layers";
import { useLayerRenderer } from "@/components/camera/aftershot/use-layer-renderer";
import { useLockedViewport } from "@/hooks/use-locked-viewport";
import { useFittedSize } from "@/hooks/use-fitted-size";

export const Route = createFileRoute("/create/after-shot/")({
  head: () => ({ meta: [{ title: "Edit — Oakmonte" }] }),
  component: AfterShotIndexPage,
});

type ToolId = "crop" | "text" | "draw" | "filter" | "sound" | "sticker" | "link";

const DEFAULT_FILTER_ID = "natural";

const EDIT_TOOLS: { id: ToolId; label: string; icon: typeof Type }[] = [
  { id: "text", label: "Text", icon: Type },
  { id: "draw", label: "Draw", icon: Pencil },
  { id: "sticker", label: "Stickers", icon: Sticker },
  { id: "sound", label: "Sound", icon: Volume2 },
  { id: "filter", label: "Filters", icon: Blend },
  { id: "link", label: "Link", icon: Link2 },
];

const COLLAPSED_TOOLS: { id: ToolId; label: string; icon: typeof Crop }[] = [
  { id: "crop", label: "Crop", icon: Crop },
];

function AfterShotIndexPage() {
  useLockedViewport();
  const navigate = useNavigate();
  const { media, setMedia, discard } = useAfterShotContext();

  const mediaBoxRef = useRef<HTMLDivElement>(null);
  const mediaAreaRef = useRef<HTMLDivElement>(null);
  const { layers, addLayer, updateLayer, selectedLayerId, setSelectedLayerId } =
    useAfterShotLayers();
  const renderLayerContent = useLayerRenderer(mediaBoxRef);

  const [toolsExpanded, setToolsExpanded] = useState(false);
  const [mediaAspect, setMediaAspect] = useState(9 / 16);
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);
  // Captured video autoplays muted because that's the only way a browser will
  // autoplay it at all — the toggle is what gets the sound back.
  const [videoMuted, setVideoMuted] = useState(true);

  // Owned once, here, from the page's own real <img>/<video> load event —
  // this is what CropPanel now receives as a prop instead of loading its
  // own invisible probe element to re-derive the same numbers.
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);

  // Filters stay a quick pick-one-and-apply interaction (matching
  // FilterPanel's existing bottom-sheet shape from create.tsx) rather than
  // an overlay panel like Crop/Text/Draw, since there's nothing to place or
  // drag — just re-encoding the whole frame, same as the old filters route.
  const [selectedFilterId, setSelectedFilterId] = useState(DEFAULT_FILTER_ID);
  // What the filter list is currently hovering on, before you commit to it.
  // FilterPanel drives this through onPreview and resets it itself on discard.
  const [previewFilterId, setPreviewFilterId] = useState<string | null>(null);
  const [favoritedFilterIds, setFavoritedFilterIds] = useState<Set<string>>(new Set());
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);

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

  // Explicit contain-fit. See use-fitted-size.ts for why CSS alone silently
  // gave the box the SCREEN's aspect instead of the media's.
  const fitted = useFittedSize(mediaAreaRef, mediaAspect);

  const closeTool = useCallback(() => setActiveTool(null), []);

  // Stickers are gallery images. Object URLs are held here and revoked on
  // unmount — the layer stack only stores the URL string, so nothing else owns
  // them and they'd otherwise leak for the life of the tab.
  const stickerInputRef = useRef<HTMLInputElement>(null);
  const stickerUrlsRef = useRef<string[]>([]);
  useEffect(
    () => () => {
      stickerUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      stickerUrlsRef.current = [];
    },
    [],
  );

  const handleStickerFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        const url = URL.createObjectURL(file);
        stickerUrlsRef.current.push(url);
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

  // Filters are a CSS property on the preview element and a value handed to the
  // exporter — never a re-encode of media.blob. Baking on every tap meant each
  // pick re-filtered the ALREADY filtered pixels, so choosing Vivid then Noir
  // gave you Noir stacked on Vivid, plus a fresh generation of compression loss
  // for every filter you merely auditioned.
  const previewFilterCss =
    CAMERA_FILTERS.find((f) => f.id === (previewFilterId ?? selectedFilterId))?.css ?? "none";
  const exportFilterCss = CAMERA_FILTERS.find((f) => f.id === selectedFilterId)?.css ?? "none";

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
      const blob = await exportComposite(media, exportFilterCss, layers, setExportProgress);
      // Same blob back means exportComposite took its no-op fast path; replacing
      // the media (and revoking the old URL) would only churn for nothing.
      if (blob !== media.blob) {
        const url = URL.createObjectURL(blob);
        setMedia(
          media.type === "photo"
            ? { type: "photo", blob, url, poster: media.poster }
            : // The cover frame the studio picked has to survive this hop, or the
              // Cover tool is write-only and the listing falls back to frame zero.
              { type: "video", blob, url, poster: media.poster },
        );
      }
      // Publishing/compose isn't built yet, so the flow stops here rather than
      // pretending to post. The composite is real and now sits in context —
      // whatever screen comes next reads it straight from useAfterShotContext.
      console.info("Export complete:", blob.type, blob.size, "bytes");
    } catch (err) {
      console.error("Export failed:", err);
      setExportError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }, [media, exportFilterCss, layers, setMedia]);

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
          different on the two screens. This is now "contain" on both. */}
      <div ref={mediaAreaRef} className="absolute inset-0 flex items-center justify-center">
        <div
          ref={mediaBoxRef}
          className="relative overflow-hidden"
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
              className="absolute inset-0 w-full h-full object-cover"
              style={{ filter: previewFilterCss }}
            />
          ) : (
            <video
              src={media.url}
              autoPlay
              loop
              muted={videoMuted}
              playsInline
              onLoadedMetadata={handleVideoLoad}
              className="absolute inset-0 w-full h-full object-cover"
              style={{ filter: previewFilterCss }}
            />
          )}

          {exporting && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 z-30">
              <span className="text-sm uppercase tracking-widest">
                {media.type === "video"
                  ? `Exporting… ${Math.round(exportProgress * 100)}%`
                  : "Exporting…"}
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
            <div className="absolute inset-x-4 bottom-4 rounded-xl px-4 py-3 bg-black/80 z-30">
              <p className="text-xs text-red-300">{exportError}</p>
            </div>
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

      <TextPanel
        open={activeTool === "text"}
        containerRef={mediaBoxRef}
        editingLayerId={editingLayerId}
        onClose={closeTool}
      />

      {activeTool === null && (
        <>
          <div className="absolute top-0 left-0 right-0 flex items-center gap-3 px-4 pt-[calc(env(safe-area-inset-top)+12px)] z-20">
            <button
              onClick={discard}
              aria-label="Discard and retake"
              className="flex items-center justify-center w-10 h-10 rounded-full transition-transform duration-150 active:scale-90"
              style={{ background: "rgba(255,255,255,0.10)", backdropFilter: "blur(12px)" }}
            >
              <X size={20} />
            </button>

            {media.type === "video" && (
              <button
                onClick={() => setVideoMuted((m) => !m)}
                aria-label={videoMuted ? "Unmute preview" : "Mute preview"}
                aria-pressed={!videoMuted}
                className="flex items-center justify-center w-10 h-10 rounded-full transition-transform duration-150 active:scale-90"
                style={{ background: "rgba(255,255,255,0.10)", backdropFilter: "blur(12px)" }}
              >
                {videoMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
            )}
          </div>

          <div
            className="absolute right-4 flex flex-col items-end gap-5 z-20"
            style={{ top: "calc(env(safe-area-inset-top) + 76px)" }}
          >
            {media.type === "video" && (
              // A clapperboard, not the old scissors: what sits behind this is a
              // multi-clip editor, and an icon that still says "trim" undersells
              // it to the point that people won't open it.
              <button
                onClick={() => navigate({ to: "/create/after-shot/studio" })}
                aria-label="Open video studio"
                className="flex items-center gap-2 opacity-90"
              >
                <Clapperboard size={24} />
              </button>
            )}

            {EDIT_TOOLS.map((tool) => {
              const Icon = tool.icon;
              return (
                <button
                  key={tool.id}
                  onClick={() => {
                    if (tool.id === "text") {
                      setEditingLayerId(null);
                      setActiveTool("text");
                    } else if (tool.id === "draw") setActiveTool(tool.id);
                    else if (tool.id === "filter") setActiveTool("filter");
                    else if (tool.id === "sticker") stickerInputRef.current?.click();
                  }}
                  aria-label={tool.label}
                  className="flex items-center gap-2 opacity-90"
                >
                  <Icon size={24} />
                </button>
              );
            })}

            {toolsExpanded &&
              COLLAPSED_TOOLS.map((tool) => {
                const Icon = tool.icon;
                return (
                  <button
                    key={tool.id}
                    onClick={() => setActiveTool(tool.id)}
                    aria-label={tool.label}
                    className="flex items-center gap-2 opacity-90"
                  >
                    <Icon size={24} />
                  </button>
                );
              })}

            <button
              onClick={() => setToolsExpanded((v) => !v)}
              aria-label={toolsExpanded ? "Hide more tools" : "More tools"}
              className="flex items-center justify-center w-8 h-8 mt-1"
            >
              {toolsExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
          </div>

          <div
            className="absolute left-0 right-0 flex items-center justify-end px-5 z-20"
            style={{ bottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
          >
            <button
              onClick={handleNext}
              disabled={exporting}
              aria-label="Export edited media"
              className="px-6 py-2.5 rounded-full font-bold text-sm uppercase tracking-wide disabled:opacity-50 transition-transform duration-150 active:scale-95"
              style={{ background: "#fff", color: "#000" }}
            >
              {exporting ? "Exporting…" : "Next"}
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
        favoriteIds={favoritedFilterIds}
        onClose={closeTool}
        onPreview={setPreviewFilterId}
        onApply={(id) => {
          setSelectedFilterId(id);
          setPreviewFilterId(null);
        }}
        onToggleFavorite={toggleFilterFavorite}
      />
    </div>
  );
}
