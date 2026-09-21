import {
  Input,
  Output,
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  Mp4OutputFormat,
  CanvasSource,
  VideoSampleSink,
  EncodedPacketSink,
  EncodedAudioPacketSource,
  QUALITY_HIGH,
  getFirstEncodableVideoCodec,
} from "mediabunny";
import {
  applyCompiledFilter,
  compileFilter,
  IDENTITY_FILTER,
  type CompiledFilter,
} from "@/lib/canvas-filter";
import { drawVignette } from "@/lib/vignette";
import { compileGrade, isNoopFilter, type CameraFilter } from "@/components/camera/filter-data";
import { drawLayers, preloadStickers } from "@/lib/layer-bake";
import type { Layer } from "@/lib/after-shot-layers";
import type { CapturedMedia } from "@/lib/capture-handoff";
import {
  ExtendedPhotoAdjust,
  EXTENDED_NEUTRAL_ADJUST,
  adjustToCss,
  isNeutralAdjust,
} from "@/lib/photo-adjust";
import { type CropRect, isCropNoop } from "@/lib/crop-rect";

// The single place a finished post is produced. Everything the after-shot screen
// lets you do — crop, filter, text, drawings, stickers — lands on the frame in
// ONE pass here.
//
// It reads as more code than calling the old per-tool helpers in sequence, and
// that is the point. Those helpers each decoded, re-encoded and handed back a
// new blob, so a filtered + captioned clip went through three generations of
// lossy re-encode before anyone saw it, and picking a second filter re-filtered
// the already-filtered pixels. Compositing once, from the untouched capture,
// costs one generation regardless of how many edits are stacked. Crop used to
// be the one holdout — CropPanel baked immediately via crop-media.ts — which
// meant a cropped-then-filtered photo paid for two generations instead of one;
// it's a CropRect (crop-rect.ts) carried as intent now, same as everything
// else here.

/** Pixel crop rect for a specific naturalWidth/naturalHeight, from a
 *  fractional CropRect. Shared by the photo and video paths below. */
function pixelCrop(rect: CropRect, naturalWidth: number, naturalHeight: number) {
  return {
    x: Math.round(rect.x * naturalWidth),
    y: Math.round(rect.y * naturalHeight),
    w: Math.max(1, Math.round(rect.w * naturalWidth)),
    h: Math.max(1, Math.round(rect.h * naturalHeight)),
  };
}

export type ExportProgress = (ratio: number) => void;

// Frame rate for the composited output. The capture path records at 30, and
// matching it keeps timestamps honest without interpolating frames.
const OUTPUT_FPS = 30;

function drawFilteredFrame(
  ctx: CanvasRenderingContext2D,
  compiled: CompiledFilter,
  width: number,
  height: number,
) {
  if (compiled === IDENTITY_FILTER) return;
  const frame = ctx.getImageData(0, 0, width, height);
  applyCompiledFilter(frame, compiled);
  ctx.putImageData(frame, 0, 0);
}

export async function exportPhoto(
  blob: Blob,
  filter: CameraFilter,
  intensity: number,
  layers: Layer[],
  crop: CropRect | null,
  adjust: ExtendedPhotoAdjust = EXTENDED_NEUTRAL_ADJUST,
): Promise<Blob> {
  const img = new Image();
  const url = URL.createObjectURL(blob);
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load photo for export"));
      img.src = url;
    });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas 2D context unavailable");

    // Crop first — everything after this (filter, layers) draws against the
    // already-cropped frame, matching what the live preview showed.
    if (crop && !isCropNoop(crop)) {
      const c = pixelCrop(crop, img.naturalWidth, img.naturalHeight);
      canvas.width = c.w;
      canvas.height = c.h;
      ctx.drawImage(img, c.x, c.y, c.w, c.h, 0, 0, c.w, c.h);
    } else {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);
    }
    // Filter next, layers last — a caption shouldn't get tinted by the
    // filter sitting under it, which is what the preview shows too (the CSS
    // filter is on the media element, not the layer overlay). Uses the real
    // grade (compileGrade), not the preview's CSS approximation — a one-shot
    // bake like this one can afford the true LUT.
    const adjustCss = adjustToCss(adjust);
    const vignetteValue = adjust.vignette;
    drawFilteredFrame(
      ctx,
      compileGradeWithAdjust(filter, intensity, adjustCss),
      canvas.width,
      canvas.height,
    );
    // Apply vignette after filter but before layers
    drawVignette(ctx, canvas.width, canvas.height, vignetteValue);
    drawLayers(ctx, layers, canvas.width, canvas.height, await preloadStickers(layers));

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
        "image/jpeg",
        0.95,
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function exportVideo(
  blob: Blob,
  filter: CameraFilter,
  intensity: number,
  layers: Layer[],
  crop: CropRect | null,
  onProgress?: ExportProgress,
  adjust: ExtendedPhotoAdjust = EXTENDED_NEUTRAL_ADJUST,
): Promise<Blob> {
  const adjustCss = adjustToCss(adjust);
  const vignetteValue = adjust.vignette;
  const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
  const videoTrack = await input.getPrimaryVideoTrack();
  if (!videoTrack) throw new Error("No video track to export");

  const duration = await input.computeDuration();
  const sourceWidth = videoTrack.displayWidth;
  const sourceHeight = videoTrack.displayHeight;
  const hasCrop = !!crop && !isCropNoop(crop);
  const cropPx = hasCrop ? pixelCrop(crop!, sourceWidth, sourceHeight) : null;
  const width = cropPx?.w ?? sourceWidth;
  const height = cropPx?.h ?? sourceHeight;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  // Same true-grade bake as exportPhoto. This runs once per frame of the
  // finished clip, same as the matrix engine did before it — heavier per
  // pixel, but this is an async "Applying…" step with a progress bar, not a
  // live/interactive path, so the extra cost is time, not jank.
  // Adjustments ride in the same compiled filter as the grade, exactly as they
  // do on the photo path. They used not to reach here at all: `exportVideo`
  // took no adjustCss, so a tone tweak on a clip was silently dropped between
  // the preview and the file. One shared helper, one pass over the pixels.
  const compiled = compileGradeWithAdjust(filter, intensity, adjustCss);
  const stickers = await preloadStickers(layers);

  const target = new BufferTarget();
  const format = new Mp4OutputFormat();
  const output = new Output({ format, target });

  // Only offer the encoder codecs this container can actually hold — asking for
  // VP8-in-MP4 gets you a file nothing will play.
  const codec = await getFirstEncodableVideoCodec(format.getSupportedVideoCodecs(), {
    width,
    height,
    quality: QUALITY_HIGH,
  });
  if (!codec) throw new Error("No encodable video codec available on this device");

  const canvasSource = new CanvasSource(canvas, { codec, quality: QUALITY_HIGH });
  output.addVideoTrack(canvasSource);

  // Audio rides through untouched as encoded packets. Decoding and re-encoding it
  // would cost a generation of quality for no reason — nothing on this screen
  // edits sound. If the capture's audio codec can't live in MP4 we drop the
  // track rather than fail the export outright: a silent post beats no post.
  const audioTrack = await input.getPrimaryAudioTrack();
  const audioCodec = audioTrack?.codec ?? null;
  const audioConfig =
    audioTrack && audioCodec && format.getSupportedAudioCodecs().includes(audioCodec)
      ? await audioTrack.getDecoderConfig()
      : null;
  let audioSource: EncodedAudioPacketSource | null = null;
  if (audioTrack && audioCodec && audioConfig) {
    audioSource = new EncodedAudioPacketSource(audioCodec);
    output.addAudioTrack(audioSource);
  }

  await output.start();

  try {
    if (audioTrack && audioSource && audioConfig) {
      const packetSink = new EncodedPacketSink(audioTrack);
      let first = true;
      for await (const packet of packetSink.packets()) {
        await audioSource.add(packet, first ? { decoderConfig: audioConfig } : undefined);
        first = false;
      }
      audioSource.close();
    }

    const fallbackDuration = 1 / OUTPUT_FPS;
    const sink = new VideoSampleSink(videoTrack);

    for await (const sample of sink.samples()) {
      const timestamp = sample.timestamp;
      try {
        ctx.clearRect(0, 0, width, height);
        // No source-rect form on VideoSample.draw, so cropping is done the
        // same way the live preview simulates it (create.after-shot.index.tsx):
        // draw the full frame at natural size, shifted so the crop's top-left
        // lands at the canvas origin — the canvas being sized to exactly the
        // crop clips the rest for free.
        if (cropPx) {
          sample.draw(ctx, -cropPx.x, -cropPx.y, sourceWidth, sourceHeight);
        } else {
          sample.draw(ctx, 0, 0, width, height);
        }
        drawFilteredFrame(ctx, compiled, width, height);

        // Apply vignette after filter but before layers
        drawVignette(ctx, width, height, vignetteValue);
        drawLayers(ctx, layers, width, height, stickers);
        // than index/FPS, so a variable-frame-rate capture (which is what phone
        // cameras and MediaRecorder actually produce) keeps its original timing
        // instead of drifting out of sync with the audio.
        await canvasSource.add(timestamp, sample.duration || fallbackDuration);
      } finally {
        sample.close();
      }
      if (onProgress && duration > 0) onProgress(Math.min(1, timestamp / duration));
    }

    canvasSource.close();
    await output.finalize();
    onProgress?.(1);

    if (!target.buffer) throw new Error("Export produced no output buffer");
    return new Blob([target.buffer], { type: "video/mp4" });
  } catch (err) {
    await output.cancel().catch(() => {});
    throw err;
  }
}

/** Nothing to composite: no crop, no filter, no captions, no drawings, no
 *  stickers. */
function isUnedited(
  filter: CameraFilter,
  intensity: number,
  layers: Layer[],
  crop: CropRect | null,
  adjustCss: string,
): boolean {
  return (
    isNoopFilter(filter, intensity) &&
    layers.length === 0 &&
    isCropNoop(crop) &&
    // adjustToCss returns the literal string "none" for a neutral adjust,
    // never "" — this compared against the wrong sentinel, so the fast
    // no-op path below never actually fired for an untouched Adjust panel.
    (adjustCss === "" || adjustCss === "none")
  );
}

/** The grade plus any manual tone adjustments, as ONE compiled filter.
 *
 *  Adjustments are appended as extra ops rather than merged into the grade's
 *  own string: a graded filter bakes through a LUT, which has no CSS string to
 *  concatenate onto. Both land in the same `ops` array, so
 *  applyCompiledFilter still walks the pixels exactly once — the whole
 *  one-pass invariant survives adding a tool. */
function compileGradeWithAdjust(
  filter: CameraFilter,
  intensity: number,
  adjustCss: string,
): CompiledFilter {
  const grade = compileGrade(filter, intensity);
  if (!adjustCss) return grade;
  const adjust = compileFilter(adjustCss);
  return { ops: [...grade.ops, ...adjust.ops] };
}

// What the Next button calls. Keeps the photo/video branch in one place so the
// route doesn't have to know which encoder path applies.
//
// The early return matters more than it looks. Since the studio landed, a video
// arriving here has usually ALREADY been encoded once by studio/export.ts, and
// re-encoding it to apply nothing would cost the seller a second full
// generation of compression on the one asset the listing is judged by. The
// pipeline's rule is one pass from the untouched capture; when this screen adds
// nothing, the honest number of passes is zero.
export async function exportComposite(
  media: CapturedMedia,
  filter: CameraFilter,
  intensity: number,
  layers: Layer[],
  crop: CropRect | null,
  onProgress?: ExportProgress,
  adjust: ExtendedPhotoAdjust = EXTENDED_NEUTRAL_ADJUST,
): Promise<Blob> {
  const adjustCss = adjustToCss(adjust);
  if (isUnedited(filter, intensity, layers, crop, adjustCss)) {
    onProgress?.(1);
    return media.blob;
  }
  return media.type === "photo"
    ? await exportPhoto(media.blob, filter, intensity, layers, crop, adjust)
    : await exportVideo(media.blob, filter, intensity, layers, crop, onProgress, adjust);
}
