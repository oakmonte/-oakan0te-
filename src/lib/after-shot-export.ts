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
import { compileFilter, applyCompiledFilter, IDENTITY_FILTER } from "@/lib/canvas-filter";
import { drawLayers, preloadStickers } from "@/lib/layer-bake";
import type { Layer } from "@/lib/after-shot-layers";
import type { CapturedMedia } from "@/lib/capture-handoff";

// The single place a finished post is produced. Everything the after-shot screen
// lets you do — filter, text, drawings, stickers — lands on the frame in ONE
// pass here.
//
// It reads as more code than calling the old per-tool helpers in sequence, and
// that is the point. Those helpers each decoded, re-encoded and handed back a
// new blob, so a filtered + captioned clip went through three generations of
// lossy re-encode before anyone saw it, and picking a second filter re-filtered
// the already-filtered pixels. Compositing once, from the untouched capture,
// costs one generation regardless of how many edits are stacked.

export type ExportProgress = (ratio: number) => void;

// Frame rate for the composited output. The capture path records at 30, and
// matching it keeps timestamps honest without interpolating frames.
const OUTPUT_FPS = 30;

function drawFilteredFrame(
  ctx: CanvasRenderingContext2D,
  compiled: ReturnType<typeof compileFilter>,
  width: number,
  height: number,
) {
  if (compiled === IDENTITY_FILTER) return;
  const frame = ctx.getImageData(0, 0, width, height);
  applyCompiledFilter(frame, compiled);
  ctx.putImageData(frame, 0, 0);
}

export async function exportPhoto(blob: Blob, filterCss: string, layers: Layer[]): Promise<Blob> {
  const img = new Image();
  const url = URL.createObjectURL(blob);
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load photo for export"));
      img.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas 2D context unavailable");

    ctx.drawImage(img, 0, 0);
    // Filter first, layers second — a caption shouldn't get tinted by the
    // filter sitting under it, which is what the preview shows too (the CSS
    // filter is on the media element, not the layer overlay).
    drawFilteredFrame(ctx, compileFilter(filterCss), canvas.width, canvas.height);
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
  filterCss: string,
  layers: Layer[],
  onProgress?: ExportProgress,
): Promise<Blob> {
  const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
  const videoTrack = await input.getPrimaryVideoTrack();
  if (!videoTrack) throw new Error("No video track to export");

  const duration = await input.computeDuration();
  const width = videoTrack.displayWidth;
  const height = videoTrack.displayHeight;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  const compiled = compileFilter(filterCss);
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
        sample.draw(ctx, 0, 0, width, height);
        drawFilteredFrame(ctx, compiled, width, height);
        drawLayers(ctx, layers, width, height, stickers);
        // Encode against the source frame's real presentation timestamp rather
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

// What the Next button calls. Keeps the photo/video branch in one place so the
// route doesn't have to know which encoder path applies.
export async function exportComposite(
  media: CapturedMedia,
  filterCss: string,
  layers: Layer[],
  onProgress?: ExportProgress,
): Promise<Blob> {
  return media.type === "photo"
    ? await exportPhoto(media.blob, filterCss, layers)
    : await exportVideo(media.blob, filterCss, layers, onProgress);
}
