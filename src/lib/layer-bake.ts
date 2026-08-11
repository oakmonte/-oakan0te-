import type { Layer, TextLayer, StickerLayer, DrawLayer } from "@/lib/after-shot-layers";

// Draws one layer onto ctx at its fractional x/y/scale/rotation, translated
// into actual canvas pixels. Every layer kind shares the same
// translate -> rotate -> scale setup; only the actual drawing call differs.
// This mirrors LayerOverlay.tsx's CSS transform math exactly
// (translate(-50%,-50%) rotate() scale()) so what you see while editing is
// what gets baked — no separate "preview math" vs "bake math" to keep in sync.
function withLayerTransform(
  ctx: CanvasRenderingContext2D,
  layer: Layer,
  canvasW: number,
  canvasH: number,
  draw: () => void,
) {
  ctx.save();
  const cx = layer.x * canvasW;
  const cy = layer.y * canvasH;
  ctx.translate(cx, cy);
  ctx.rotate((layer.rotation * Math.PI) / 180);
  ctx.scale(layer.scale, layer.scale);
  draw();
  ctx.restore();
}

function drawTextLayer(ctx: CanvasRenderingContext2D, layer: TextLayer, canvasW: number) {
  const fontSize = Math.round(layer.fontSize * canvasW);
  ctx.font = `${layer.fontWeight} ${fontSize}px ${layer.font}`;
  ctx.textAlign = layer.align;
  ctx.textBaseline = "middle";

  if (layer.boxColor) {
    const metrics = ctx.measureText(layer.content);
    const padX = fontSize * 0.25;
    const padY = fontSize * 0.15;
    const boxW = metrics.width + padX * 2;
    const boxH = fontSize + padY * 2;
    const boxX = layer.align === "left" ? -padX : layer.align === "right" ? -boxW + padX : -boxW / 2;
    ctx.fillStyle = layer.boxColor;
    ctx.fillRect(boxX, -boxH / 2, boxW, boxH);
  }

  ctx.fillStyle = layer.color;
  ctx.fillText(layer.content, 0, 0);
}

async function drawStickerLayer(ctx: CanvasRenderingContext2D, layer: StickerLayer, canvasW: number) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to load sticker: ${layer.assetUrl}`));
    img.src = layer.assetUrl;
  });
  // Stickers draw at a fixed fraction of canvas width, height derived from
  // the asset's own aspect ratio — scale (from pinch/drag) multiplies on
  // top of this via the ctx.scale() already applied in withLayerTransform.
  const baseW = canvasW * 0.25;
  const baseH = baseW * (img.naturalHeight / img.naturalWidth);
  ctx.drawImage(img, -baseW / 2, -baseH / 2, baseW, baseH);
}

function drawDrawLayer(ctx: CanvasRenderingContext2D, layer: DrawLayer, canvasW: number) {
  // Strokes are stored in the SAME layer-local coordinate space as
  // everything else (fractional, relative to canvasW) — withLayerTransform
  // has already translated/rotated/scaled to the layer's origin, so each
  // point just needs converting from a 0-1 fraction to raw pixels here.
  for (const stroke of layer.strokes) {
    if (stroke.points.length < 2) continue;
    ctx.beginPath();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width * canvasW;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const [firstX, firstY] = stroke.points[0];
    ctx.moveTo(firstX * canvasW, firstY * canvasW);
    for (let i = 1; i < stroke.points.length; i++) {
      const [x, y] = stroke.points[i];
      ctx.lineTo(x * canvasW, y * canvasW);
    }
    ctx.stroke();
  }
}

// Single entry point every layer kind funnels through — bake-time mirror of
// what renderLayerContent does at edit-time in LayerOverlay.tsx.
async function drawLayer(ctx: CanvasRenderingContext2D, layer: Layer, canvasW: number, canvasH: number) {
  await withLayerTransformAsync(ctx, layer, canvasW, canvasH, async () => {
    if (layer.kind === "text") drawTextLayer(ctx, layer, canvasW);
    else if (layer.kind === "sticker") await drawStickerLayer(ctx, layer, canvasW);
    else drawDrawLayer(ctx, layer, canvasW);
  });
}

// Same as withLayerTransform but awaits an async draw callback (needed for
// stickers, which load an <img> before they can be drawn) — save/restore
// still has to wrap the whole await, or a later layer's transform would
// bleed into this one mid-load.
async function withLayerTransformAsync(
  ctx: CanvasRenderingContext2D,
  layer: Layer,
  canvasW: number,
  canvasH: number,
  draw: () => void | Promise<void>,
) {
  ctx.save();
  const cx = layer.x * canvasW;
  const cy = layer.y * canvasH;
  ctx.translate(cx, cy);
  ctx.rotate((layer.rotation * Math.PI) / 180);
  ctx.scale(layer.scale, layer.scale);
  await draw();
  ctx.restore();
}

async function drawAllLayers(ctx: CanvasRenderingContext2D, layers: Layer[], canvasW: number, canvasH: number) {
  const sorted = [...layers].sort((a, b) => a.zIndex - b.zIndex);
  for (const layer of sorted) {
    await drawLayer(ctx, layer, canvasW, canvasH);
  }
}

export async function bakeLayersOntoPhotoBlob(blob: Blob, layers: Layer[]): Promise<Blob> {
  if (layers.length === 0) return blob; // no-op, same short-circuit filters.tsx already uses for "natural"

  const img = new Image();
  const url = URL.createObjectURL(blob);
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load image for layer bake"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");

    ctx.drawImage(img, 0, 0);
    await drawAllLayers(ctx, layers, canvas.width, canvas.height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/jpeg", 0.96);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Same draw-loop + MediaRecorder re-encode as crop-media.ts/filter-media.ts
// — every frame gets the source video drawn, then every layer redrawn on
// top at its fixed position. Layers are static for v1 (no per-layer
// animation/keyframing), so redrawing the same layer stack every frame is
// correct, just repeated work — fine at this scale.
export async function bakeLayersOntoVideoBlob(
  blob: Blob,
  layers: Layer[],
  onProgress?: (ratio: number) => void,
): Promise<Blob> {
  if (layers.length === 0) return blob;

  // Preload sticker images once, outside the per-frame loop — drawStickerLayer
  // reloads from assetUrl otherwise, which is wasted work at 30fps and can
  // desync a slow-loading image mid-recording.
  const stickerCache = new Map<string, HTMLImageElement>();
  await Promise.all(
    layers
      .filter((l): l is StickerLayer => l.kind === "sticker")
      .map(
        (l) =>
          new Promise<void>((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
              stickerCache.set(l.id, img);
              resolve();
            };
            img.onerror = () => reject(new Error(`Failed to load sticker: ${l.assetUrl}`));
            img.src = l.assetUrl;
          }),
      ),
  );

  const drawStickerLayerCached = (ctx: CanvasRenderingContext2D, layer: StickerLayer, canvasW: number) => {
    const img = stickerCache.get(layer.id);
    if (!img) return;
    const baseW = canvasW * 0.25;
    const baseH = baseW * (img.naturalHeight / img.naturalWidth);
    ctx.drawImage(img, -baseW / 2, -baseH / 2, baseW, baseH);
  };

  const drawAllLayersSync = (ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number) => {
    const sorted = [...layers].sort((a, b) => a.zIndex - b.zIndex);
    for (const layer of sorted) {
      ctx.save();
      const cx = layer.x * canvasW;
      const cy = layer.y * canvasH;
      ctx.translate(cx, cy);
      ctx.rotate((layer.rotation * Math.PI) / 180);
      ctx.scale(layer.scale, layer.scale);
      if (layer.kind === "text") drawTextLayer(ctx, layer, canvasW);
      else if (layer.kind === "sticker") drawStickerLayerCached(ctx, layer, canvasW);
      else drawDrawLayer(ctx, layer, canvasW);
      ctx.restore();
    }
  };

  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  const url = URL.createObjectURL(blob);
  video.src = url;

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Failed to load video for layer bake"));
    });

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");

    const sourceStream = (video as HTMLVideoElement & { captureStream: () => MediaStream }).captureStream();
    const audioTracks = sourceStream.getAudioTracks();

    const canvasStream = canvas.captureStream(30);
    audioTracks.forEach((t) => canvasStream.addTrack(t));

    const candidates = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];
    const mimeType = candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
    const recorder = new MediaRecorder(canvasStream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    let rafId: number | null = null;
    const drawFrame = () => {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      drawAllLayersSync(ctx, canvas.width, canvas.height);
      if (onProgress && video.duration > 0) onProgress(Math.min(1, video.currentTime / video.duration));
      rafId = requestAnimationFrame(drawFrame);
    };

    return await new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => {
        if (rafId !== null) cancelAnimationFrame(rafId);
        resolve(new Blob(chunks, { type: mimeType || "video/webm" }));
      };
      recorder.onerror = () => {
        if (rafId !== null) cancelAnimationFrame(rafId);
        reject(new Error("Recording failed during layer bake"));
      };
      video.onended = () => recorder.stop();
      recorder.start();
      drawFrame();
      video.play().catch(reject);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}