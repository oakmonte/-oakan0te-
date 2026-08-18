import {
  TEXT_LAYER_WIDTH_FRACTION,
  TEXT_LAYER_LINE_HEIGHT,
  TEXT_LAYER_BOX_PAD_X,
  TEXT_LAYER_BOX_PAD_Y,
  TEXT_LAYER_BOX_RADIUS,
  TEXT_LAYER_SHADOW_BLUR,
  TEXT_LAYER_SHADOW_OFFSET_Y,
  TEXT_LAYER_SHADOW_COLOR,
} from "@/lib/after-shot-layers";
import type { Layer, TextLayer, StickerLayer, DrawLayer } from "@/lib/after-shot-layers";

// Pure canvas rendering for the after-shot layer stack. Deliberately contains no
// blob/encode logic — after-shot-export.ts owns that, so the photo path and the
// video path composite through this exact same code and can't drift apart.
//
// This is the bake-time mirror of renderLayerContent + LayerOverlay's CSS
// transforms on the after-shot page. Every number that decides where a glyph
// lands lives in after-shot-layers.ts and is consumed by both sides.

export type StickerCache = Map<string, HTMLImageElement>;

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

// Mirrors what CSS does to the placed text span: honour explicit newlines, greedy
// word-wrap inside each, then hard-break any single word still too wide (that
// last part is `overflow-wrap: break-word`). Without this the bake would run one
// long ctx.fillText straight off the edge of the frame while the preview showed
// a tidy wrapped block.
export function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];

  const pushBrokenWord = (word: string) => {
    let chunk = "";
    for (const char of word) {
      if (chunk && ctx.measureText(chunk + char).width > maxWidth) {
        lines.push(chunk);
        chunk = char;
      } else {
        chunk += char;
      }
    }
    return chunk;
  };

  for (const paragraph of text.split("\n")) {
    if (paragraph === "") {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      // The word alone may still overflow — break it across lines.
      line = ctx.measureText(word).width > maxWidth ? pushBrokenWord(word) : word;
    }
    lines.push(line);
  }

  return lines.length > 0 ? lines : [""];
}

function drawTextLayer(ctx: CanvasRenderingContext2D, layer: TextLayer, canvasW: number) {
  const fontSize = layer.fontSize * canvasW;
  const padX = fontSize * TEXT_LAYER_BOX_PAD_X;
  const padY = fontSize * TEXT_LAYER_BOX_PAD_Y;
  const lineHeight = fontSize * TEXT_LAYER_LINE_HEIGHT;

  ctx.font = `${layer.fontWeight} ${fontSize}px ${layer.font}`;
  ctx.textAlign = layer.align;
  ctx.textBaseline = "middle";

  // The editor composes inside a block of exactly this width, and the box's own
  // padding eats into it — wrap against the same inner width or the line breaks
  // land in different places than the user saw.
  const blockWidth = canvasW * TEXT_LAYER_WIDTH_FRACTION;
  const contentWidth = blockWidth - (layer.boxColor ? padX * 2 : 0);
  const lines = wrapTextLines(ctx, layer.content, contentWidth);

  const widestLine = Math.max(...lines.map((l) => ctx.measureText(l).width));
  const textHeight = lines.length * lineHeight;

  // x where each line is drawn, matching how the hugging inline-block sits inside
  // the fixed-width block for each alignment.
  const lineX =
    layer.align === "left"
      ? -blockWidth / 2 + padX
      : layer.align === "right"
        ? blockWidth / 2 - padX
        : 0;

  if (layer.boxColor) {
    const boxW = widestLine + padX * 2;
    const boxH = textHeight + padY * 2;
    const boxX =
      layer.align === "left"
        ? -blockWidth / 2
        : layer.align === "right"
          ? blockWidth / 2 - boxW
          : -boxW / 2;
    ctx.fillStyle = layer.boxColor;
    ctx.beginPath();
    ctx.roundRect(boxX, -boxH / 2, boxW, boxH, fontSize * TEXT_LAYER_BOX_RADIUS);
    ctx.fill();
  } else {
    ctx.shadowColor = TEXT_LAYER_SHADOW_COLOR;
    ctx.shadowBlur = fontSize * TEXT_LAYER_SHADOW_BLUR;
    ctx.shadowOffsetY = fontSize * TEXT_LAYER_SHADOW_OFFSET_Y;
  }

  ctx.fillStyle = layer.color;
  // textBaseline is middle, so the first line's centre sits half a line below the
  // top of the block.
  const firstLineY = -textHeight / 2 + lineHeight / 2;
  lines.forEach((line, i) => {
    if (line) ctx.fillText(line, lineX, firstLineY + i * lineHeight);
  });

  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

// ---------------------------------------------------------------------------
// Draw + sticker
// ---------------------------------------------------------------------------

function drawDrawLayer(ctx: CanvasRenderingContext2D, layer: DrawLayer, canvasW: number) {
  // Strokes are stored in the SAME layer-local coordinate space as everything
  // else (fractional, relative to canvasW) — the caller has already translated/
  // rotated/scaled to the layer's origin, so each point just needs converting
  // from a 0-1 fraction to raw pixels here.
  for (const stroke of layer.strokes) {
    if (stroke.points.length < 2) continue;
    ctx.beginPath();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width * canvasW;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (stroke.glow) {
      ctx.shadowColor = stroke.color;
      ctx.shadowBlur = stroke.width * canvasW * 1.2;
    }
    const [firstX, firstY] = stroke.points[0];
    ctx.moveTo(firstX * canvasW, firstY * canvasW);
    for (let i = 1; i < stroke.points.length; i++) {
      const [x, y] = stroke.points[i];
      ctx.lineTo(x * canvasW, y * canvasW);
    }
    ctx.stroke();
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
  }
}

function drawStickerLayer(
  ctx: CanvasRenderingContext2D,
  layer: StickerLayer,
  canvasW: number,
  stickers: StickerCache,
) {
  const img = stickers.get(layer.id);
  if (!img) return;
  // Stickers draw at a fixed fraction of canvas width, height derived from the
  // asset's own aspect ratio — pinch/drag scale multiplies on top via the
  // ctx.scale() the caller already applied.
  const baseW = canvasW * 0.25;
  const baseH = baseW * (img.naturalHeight / img.naturalWidth);
  ctx.drawImage(img, -baseW / 2, -baseH / 2, baseW, baseH);
}

// Sticker images must be resolved before the draw loop: the video path calls
// drawLayers once per frame and cannot await inside it without stalling the
// encoder or tearing a half-loaded image into the middle of a clip.
export async function preloadStickers(layers: Layer[]): Promise<StickerCache> {
  const cache: StickerCache = new Map();
  await Promise.all(
    layers
      .filter((l): l is StickerLayer => l.kind === "sticker")
      .map(
        (l) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            // A missing sticker shouldn't abort a whole export — skip it and keep
            // the rest of the composite.
            img.onload = () => {
              cache.set(l.id, img);
              resolve();
            };
            img.onerror = () => resolve();
            img.src = l.assetUrl;
          }),
      ),
  );
  return cache;
}

// Single synchronous entry point. Mirrors LayerOverlay.tsx's CSS transform chain
// exactly (translate(-50%,-50%) rotate() scale()) so what you see while editing
// is what gets baked — there is no separate "preview math" vs "bake math".
export function drawLayers(
  ctx: CanvasRenderingContext2D,
  layers: Layer[],
  canvasW: number,
  canvasH: number,
  stickers: StickerCache,
) {
  for (const layer of [...layers].sort((a, b) => a.zIndex - b.zIndex)) {
    ctx.save();
    ctx.translate(layer.x * canvasW, layer.y * canvasH);
    ctx.rotate((layer.rotation * Math.PI) / 180);
    ctx.scale(layer.scale, layer.scale);
    if (layer.kind === "text") drawTextLayer(ctx, layer, canvasW);
    else if (layer.kind === "sticker") drawStickerLayer(ctx, layer, canvasW, stickers);
    else drawDrawLayer(ctx, layer, canvasW);
    ctx.restore();
  }
}
