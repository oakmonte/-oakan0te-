import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import {
  X,
  Type,
  Pencil,
  Sticker,
  Volume2,
  Blend,
  Link2,
  Crop,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useAfterShotContext } from "@/lib/after-shot-context";
import { TrimIcon } from "@/components/camera/aftershot-icons";
import TextPanel from "@/components/camera/aftershot/TextPanel";
import CropPanel from "@/components/camera/aftershot/CropPanel";
import DrawPanel from "@/components/camera/aftershot/DrawPanel";
import FilterPanel from "@/components/camera/FilterPanel";
import { CAMERA_FILTERS } from "@/components/camera/filter-data";
import { applyFilterToPhotoBlob, applyFilterToVideoBlob } from "@/lib/filter-media";
import LayerOverlay from "@/components/camera/LayerOverlay";
import { useAfterShotLayers, AfterShotLayersContext, useAfterShotLayersState, type Layer } from "@/lib/after-shot-layers";
import { useLockedViewport } from "@/hooks/use-locked-viewport";

export const Route = createFileRoute("/create/after-shot/")({
  head: () => ({ meta: [{ title: "Edit — Oakmonte" }] }),
  component: AfterShotIndexWrapper,
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

// The real, shared layer stack lives here, at the page's top level, so
// every panel that adds/edits layers (Text, Draw, and later Stickers) is
// reading and writing the same array — this is the piece the old
// route-per-tool version never had, since each route unmounted before the
// next one could see what it had added.
function AfterShotIndexWrapper() {
  const layersState = useAfterShotLayersState();
  return (
    <AfterShotLayersContext.Provider value={layersState}>
      <AfterShotIndexPage />
    </AfterShotLayersContext.Provider>
  );
}

function AfterShotIndexPage() {
  useLockedViewport();
  const navigate = useNavigate();
  const { media, setMedia, discard } = useAfterShotContext();

  const mediaBoxRef = useRef<HTMLDivElement>(null);
  const { layers, renderLayerContent } = useLayerRenderer(mediaBoxRef);

  const [toolsExpanded, setToolsExpanded] = useState(false);
  const [mediaAspect, setMediaAspect] = useState(9 / 16);
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);

  // Owned once, here, from the page's own real <img>/<video> load event —
  // this is what CropPanel now receives as a prop instead of loading its
  // own invisible probe element to re-derive the same numbers.
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);

  // Filters stay a quick pick-one-and-apply interaction (matching
  // FilterPanel's existing bottom-sheet shape from create.tsx) rather than
  // an overlay panel like Crop/Text/Draw, since there's nothing to place or
  // drag — just re-encoding the whole frame, same as the old filters route.
  const [selectedFilterId, setSelectedFilterId] = useState(DEFAULT_FILTER_ID);
  const [favoritedFilterIds, setFavoritedFilterIds] = useState<Set<string>>(new Set());
  const [filterBusy, setFilterBusy] = useState(false);
  const [filterProgress, setFilterProgress] = useState(0);
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);

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

  const closeTool = useCallback(() => setActiveTool(null), []);

  const applyFilter = useCallback(
    async (filterId: string) => {
      const filter = CAMERA_FILTERS.find((f) => f.id === filterId);
      if (!filter || filterId === DEFAULT_FILTER_ID) {
        setSelectedFilterId(filterId);
        return;
      }
      setFilterBusy(true);
      setFilterProgress(0);
      try {
        const filteredBlob =
          media.type === "photo"
            ? await applyFilterToPhotoBlob(media.blob, filter.css)
            : await applyFilterToVideoBlob(media.blob, filter.css, setFilterProgress);
        const url = URL.createObjectURL(filteredBlob);
        setMedia(
          media.type === "photo"
            ? { type: "photo", blob: filteredBlob, url }
            : { type: "video", blob: filteredBlob, url },
        );
        setSelectedFilterId(filterId);
      } catch (err) {
        console.error("Filter apply failed:", err);
      } finally {
        setFilterBusy(false);
      }
    },
    [media, setMedia],
  );

  const toggleFilterFavorite = useCallback((id: string) => {
    setFavoritedFilterIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <div
      className="fixed inset-0 bg-black text-white overflow-hidden"
      style={{ fontFamily: "'SF Pro', system-ui, sans-serif" }}
    >
      {/* The ONE mounted media box for the whole after-shot page — every
          panel (Crop, Text, Draw) draws on top of this same element via
          mediaBoxRef, instead of each rendering its own copy. */}
      <div
        ref={mediaBoxRef}
        className="absolute overflow-hidden"
        style={{
          left: 0,
          right: 0,
          top: "50%",
          transform: "translateY(-50%)",
          width: "100%",
          aspectRatio: String(mediaAspect),
          background: "#000",
        }}
      >
        {media.type === "photo" ? (
          <img
            src={media.url}
            alt="Captured"
            onLoad={handlePhotoLoad}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <video
            src={media.url}
            autoPlay
            loop
            playsInline
            onLoadedMetadata={handleVideoLoad}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {filterBusy && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-30">
            <span className="text-sm uppercase tracking-widest">
              {media.type === "video" ? `Applying… ${Math.round(filterProgress * 100)}%` : "Applying…"}
            </span>
          </div>
        )}

        {/* Confirmed layers (text/draw/sticker) always render here, on the
            base page — not just while a panel is open — same as how a
            caption sits on a photo permanently once added. */}
        {activeTool === null && (
          <LayerOverlay
            containerRef={mediaBoxRef}
            layers={layers}
            updateLayer={() => {}}
            selectedLayerId={null}
            setSelectedLayerId={() => {}}
            renderLayerContent={renderLayerContent}
            onLayerTap={(layer) => {
              setEditingLayerId(layer.id);
              setActiveTool("text");
            }}
          />
        )}

        <TextPanel
          open={activeTool === "text"}
          containerRef={mediaBoxRef}
          editingLayerId={editingLayerId}
          onClose={closeTool}
        />
        <DrawPanel open={activeTool === "draw"} containerRef={mediaBoxRef} onClose={closeTool} />
        <CropPanel
          open={activeTool === "crop"}
          containerRef={mediaBoxRef}
          naturalSize={naturalSize}
          onClose={closeTool}
/>
      </div>

      {activeTool === null && (
        <>
          <div className="absolute top-0 left-0 right-0 flex items-center px-4 pt-[calc(env(safe-area-inset-top)+12px)] z-20">
            <button
              onClick={discard}
              aria-label="Discard and retake"
              className="flex items-center justify-center w-10 h-10 rounded-full transition-transform duration-150 active:scale-90"
              style={{ background: "rgba(255,255,255,0.10)", backdropFilter: "blur(12px)" }}
            >
              <X size={20} />
            </button>
          </div>

          <div
            className="absolute right-4 flex flex-col items-end gap-5 z-20"
            style={{ top: "calc(env(safe-area-inset-top) + 76px)" }}
          >
            {media.type === "video" && (
              <button
                onClick={() => navigate({ to: "/create/after-shot/edit" })}
                aria-label="Trim video"
                className="flex items-center gap-2 opacity-90"
              >
                <TrimIcon size={24} />
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
              className="px-6 py-2.5 rounded-full font-bold text-sm uppercase tracking-wide"
              style={{ background: "#fff", color: "#000" }}
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
        favoriteIds={favoritedFilterIds}
        onClose={closeTool}
        onPreview={() => {}}
        onApply={applyFilter}
        onToggleFavorite={toggleFilterFavorite}
      />
    </div>
  );
}

// Small local hook, not exported — keeps the confirmed-layers render switch
// (text/sticker/draw -> actual visual) out of the main component body.
function useLayerRenderer(mediaBoxRef: React.RefObject<HTMLDivElement | null>) {
  const { layers } = useAfterShotLayers();
  const renderLayerContent = useCallback((layer: Layer) => {
    if (layer.kind === "text") {
      const boxWidth = mediaBoxRef.current?.clientWidth ?? 0;
      return (
        <span
          style={{
            fontFamily: layer.font,
            color: layer.color,
            fontSize: layer.fontSize * boxWidth,
            fontWeight: layer.fontWeight,
            textAlign: layer.align,
            whiteSpace: "pre-wrap",
            textShadow: layer.boxColor ? "none" : "0 1px 4px rgba(0,0,0,0.4)",
            background: layer.boxColor ?? "transparent",
            padding: layer.boxColor ? "4px 10px" : 0,
            borderRadius: layer.boxColor ? 4 : 0,
            pointerEvents: "none",
          }}
        >
          {layer.content}
        </span>
      );
    }
    if (layer.kind === "draw") {
      const width = 200;
      return (
        <svg width={width} height={width} viewBox="-0.5 -0.5 1 1" style={{ overflow: "visible", pointerEvents: "none" }}>
          {layer.strokes.map((stroke, i) => (
            <polyline
              key={i}
              points={stroke.points.map(([x, y]) => `${x},${y}`).join(" ")}
              fill="none"
              stroke={stroke.color}
              strokeWidth={stroke.width}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      );
    }
    return null;
  }, [mediaBoxRef]);
  return { layers, renderLayerContent };
}

// useAfterShotLayersRef deleted entirely — no longer needed