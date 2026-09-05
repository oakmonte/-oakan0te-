import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  Crop,
  Download,
  Plus,
  Settings,
  SlidersHorizontal,
  Sticker,
  Trash2,
  Type,
  Wand2,
} from "lucide-react";
import {
  AfterShotLayersContext,
  useAfterShotLayers,
  useAfterShotLayersState,
} from "@/lib/after-shot-layers";
import type { Layer } from "@/lib/after-shot-layers";
import TextPanel from "@/components/camera/aftershot/TextPanel";
import CropPanel from "@/components/camera/aftershot/CropPanel";
import FilterPanel from "@/components/camera/FilterPanel";
import PhotoAdjustPanel from "@/components/create/PhotoAdjustPanel";
import { CAMERA_FILTERS, previewCssAtIntensity } from "@/components/camera/filter-data";
import LayerOverlay from "@/components/camera/LayerOverlay";
import { useLayerRenderer } from "@/components/camera/aftershot/use-layer-renderer";
import { useLockedViewport } from "@/hooks/use-locked-viewport";
import { useFittedSize } from "@/hooks/use-fitted-size";
import { exportPhoto } from "@/lib/after-shot-export";
import { adjustToCss, NEUTRAL_ADJUST, type PhotoAdjust } from "@/lib/photo-adjust";
import type { CropRect } from "@/lib/crop-rect";
import { ImageSourceSheet, type ImageSource } from "@/components/product-form/ImageSourceSheet";
import { DraftImagePickerSheet } from "@/components/product-form/DraftImagePickerSheet";
import { PostImagePickerSheet } from "@/components/product-form/PostImagePickerSheet";
import type { PickedMedia } from "@/components/product-form/MediaPickerSheet";
import { setPendingCapture } from "@/lib/capture-handoff";
import { takePendingDraft } from "@/lib/draft-handoff";

export const Route = createFileRoute("/create/photo-editor")({
  head: () => ({ meta: [{ title: "Photo editor — Oakmonte" }] }),
  component: PhotoEditorRoute,
});

// The photo editor. Photos only — one, or several as a carousel — reached from
// the CREATE tab. It is NOT the after-shot screen: that one edits a single
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
// Deliberately absent, per the brief: photo templates and Enhance. Sound has no
// place on a still. Stories don't exist in this product.

const DEFAULT_FILTER_ID = "natural";

type ToolId = "text" | "sticker" | "filter" | "crop" | "adjust";

const TOOLS: { id: ToolId; label: string; icon: typeof Type }[] = [
  { id: "text", label: "Text", icon: Type },
  { id: "sticker", label: "Stickers", icon: Sticker },
  { id: "filter", label: "Filters", icon: Wand2 },
  { id: "crop", label: "Crop", icon: Crop },
  { id: "adjust", label: "Adjust", icon: SlidersHorizontal },
];

/** One image in the carousel, with the whole edit stack that belongs to it.
 *  Nothing here is baked until export — `blob` stays the untouched original for
 *  the life of the session, exactly as the after-shot screen keeps its capture,
 *  so auditioning six filters costs zero generations of re-encode. */
type EditPhoto = {
  id: string;
  blob: Blob;
  url: string;
  /** True when `url` is a remote Supabase URL we haven't fetched into a blob
   *  yet. Export needs real bytes; browsing doesn't. */
  remote: boolean;
  naturalSize: { w: number; h: number } | null;
  aspect: number;
  filterId: string;
  filterIntensity: number;
  crop: CropRect | null;
  adjust: PhotoAdjust;
};

function newPhotoId() {
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function blankEdits() {
  return {
    naturalSize: null,
    aspect: 1,
    filterId: DEFAULT_FILTER_ID,
    filterIntensity: 100,
    crop: null,
    adjust: NEUTRAL_ADJUST,
  };
}

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

  const [photos, setPhotos] = useState<EditPhoto[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  // One layer stack per photo. The shared layer context only holds one at a
  // time, so switching photos parks the current stack here and hands the
  // incoming one over.
  const layersByPhoto = useRef<Record<string, Layer[]>>({});

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
  // Object URLs this screen created, revoked together on unmount. The layer
  // stack and the photo list only hold URL strings; nothing else owns them.
  const ownedUrls = useRef<string[]>([]);
  useEffect(
    () => () => {
      ownedUrls.current.forEach((u) => URL.revokeObjectURL(u));
      ownedUrls.current = [];
    },
    [],
  );

  const active = photos.find((p) => p.id === activeId) ?? null;

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

  const patchActive = useCallback(
    (patch: Partial<EditPhoto>) => {
      setPhotos((prev) => prev.map((p) => (p.id === activeId ? { ...p, ...patch } : p)));
    },
    [activeId],
  );

  function addPhotos(items: { blob?: Blob; url: string; remote: boolean }[]) {
    if (items.length === 0) return;
    const created: EditPhoto[] = items.map((it) => ({
      id: newPhotoId(),
      blob: it.blob ?? new Blob(),
      url: it.url,
      remote: it.remote,
      ...blankEdits(),
    }));
    setPhotos((prev) => [...prev, ...created]);
    setActiveId((cur) => cur ?? created[0].id);
  }

  function handleDeviceFiles(files: FileList | null) {
    if (!files) return;
    const picked: { blob: Blob; url: string; remote: boolean }[] = [];
    for (const file of Array.from(files)) {
      // Live Photos arrive from the picker as an image plus a separate movie;
      // the browser only hands over the still, which is the right half for an
      // editor that produces stills. HEIC is accepted here and decodes
      // natively on iOS — the export canvas re-encodes to JPEG anyway.
      if (!file.type.startsWith("image/")) continue;
      const url = URL.createObjectURL(file);
      ownedUrls.current.push(url);
      picked.push({ blob: file, url, remote: false });
    }
    addPhotos(picked);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // A draft tapped on the drafts page, opened here because it's a still.
  // Added as an ordinary remote photo, so it measures and edits like any other.
  const draftLoaded = useRef(false);
  useEffect(() => {
    if (draftLoaded.current) return;
    draftLoaded.current = true;
    const draft = takePendingDraft();
    if (draft) addPhotos([{ url: draft.url, remote: true }]);
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
  const bake = useCallback(async (photo: EditPhoto, photoLayers: Layer[]): Promise<Blob> => {
    let blob = photo.blob;
    if (photo.remote || blob.size === 0) {
      const res = await fetch(photo.url);
      if (!res.ok) throw new Error("Couldn't load that image");
      blob = await res.blob();
    }
    const filter = CAMERA_FILTERS.find((f) => f.id === photo.filterId) ?? CAMERA_FILTERS[0];
    return exportPhoto(
      blob,
      filter,
      photo.filterIntensity,
      photoLayers,
      photo.crop,
      adjustToCss(photo.adjust),
    );
  }, []);

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
      const blob = await bake(active, layersFor(active));
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `oakmonte-${Date.now()}.jpg`;
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
    try {
      // Only the first photo goes forward for now. after-shot's handoff carries
      // exactly one CapturedMedia, and posts are single-media in the schema —
      // carousel publishing needs both to change, which is its own piece of
      // work rather than something to fake here.
      const first = photos[0];
      const blob = await bake(first, layersFor(first));
      const url = URL.createObjectURL(blob);
      setPendingCapture({ type: "photo", blob, url });
      await navigate({ to: "/create/after-shot" });
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
            onClick={() => navigate({ to: "/create" })}
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
        style={{ top: "calc(env(safe-area-inset-top) + 64px)", bottom: 210 }}
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
              <img
                key={active.id}
                src={active.url}
                alt=""
                crossOrigin={active.remote ? "anonymous" : undefined}
                onLoad={handleLoad}
                className={active.crop ? "" : "absolute inset-0 h-full w-full object-cover"}
                style={mediaStyle()}
              />

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
          className="absolute inset-x-0 bottom-0 z-20"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
        >
          {!empty && (
            <div
              className="flex items-center justify-center gap-2 overflow-x-auto px-4 pb-3"
              style={{ scrollbarWidth: "none" }}
            >
              {photos.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setActiveId(p.id)}
                  aria-label="Select photo"
                  aria-pressed={p.id === activeId}
                  className={`h-[46px] w-[46px] shrink-0 overflow-hidden rounded-[6px] border-2 transition-colors ${
                    p.id === activeId ? "border-white" : "border-transparent opacity-60"
                  }`}
                >
                  <img src={p.url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
              <button
                type="button"
                onClick={openSource}
                aria-label="Add photos"
                className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[6px] bg-white/[0.12] active:scale-90"
              >
                <Plus size={20} />
              </button>
              {photos.length > 1 && (
                <button
                  type="button"
                  onClick={removeActive}
                  aria-label="Remove this photo"
                  className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[6px] bg-white/[0.12] text-white/70 active:scale-90"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
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
        accept="image/*,image/heic,image/heif"
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
