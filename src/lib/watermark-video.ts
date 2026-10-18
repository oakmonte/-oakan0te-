// "Save video" from a storefront post: the video, re-encoded on the phone with
// an Oakmonte watermark (wordmark + the store's name under it), handed to the
// phone's own save flow. TikTok-style: the mark sits top-left for the first
// half and bottom-right for the second, so cropping one corner doesn't remove it.
//
// Websites can't write to the gallery directly. iPhone: the share sheet's
// "Save Video" puts it in Photos. Android: the share sheet, or a download the
// gallery picks up. Desktop: a download. saveVideoFile() picks the route.
//
// mediabunny is loaded on demand -- it must stay out of the shared bundle
// (see post-media-upload.ts). One encode generation: the source is the
// uploaded file, decoded once, marked, encoded once.

import logoUrl from "@/assets/logo-o.png";

export type WatermarkProgress = (fraction: number) => void;

async function loadLogo(): Promise<ImageBitmap | null> {
  try {
    const res = await fetch(logoUrl);
    return await createImageBitmap(await res.blob());
  } catch {
    return null;
  }
}

function drawMark(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  w: number,
  h: number,
  logo: ImageBitmap | null,
  storeName: string,
  corner: "top-left" | "bottom-right",
) {
  const unit = Math.min(w, h);
  const word = Math.round(unit * 0.052);
  const sub = Math.round(unit * 0.034);
  const pad = Math.round(unit * 0.045);
  const logoH = Math.round(word * 1.25);
  const logoW = logo ? Math.round((logo.width / logo.height) * logoH) : 0;

  ctx.save();
  ctx.font = `600 ${word}px Inter, "Helvetica Neue", Arial, sans-serif`;
  const wordW = ctx.measureText("akmonte").width;
  ctx.font = `500 ${sub}px Inter, "Helvetica Neue", Arial, sans-serif`;
  const subW = ctx.measureText(storeName).width;
  const blockW = Math.max(logoW + wordW, subW);
  const blockH = logoH + sub * 1.4;

  const x = corner === "top-left" ? pad : w - pad - blockW;
  const y = corner === "top-left" ? pad * 1.6 : h - pad * 2.2 - blockH;

  ctx.globalAlpha = 0.9;
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = Math.round(unit * 0.012);
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "alphabetic";

  if (logo) {
    // The logo is a dark "O": draw it white so it reads on any video.
    const tmp = new OffscreenCanvas(logoW, logoH);
    const t = tmp.getContext("2d")!;
    t.drawImage(logo, 0, 0, logoW, logoH);
    t.globalCompositeOperation = "source-in";
    t.fillStyle = "#fff";
    t.fillRect(0, 0, logoW, logoH);
    ctx.drawImage(tmp, x, y);
  }
  ctx.font = `600 ${word}px Inter, "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText(logo ? "akmonte" : "Oakmonte", x + logoW, y + logoH * 0.86);
  ctx.font = `500 ${sub}px Inter, "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText(storeName, x, y + logoH + sub * 1.15);
  ctx.restore();
}

/** Downloads the post's video and returns it watermarked, as an MP4. */
export async function watermarkVideo(
  videoUrl: string,
  storeName: string,
  onProgress?: WatermarkProgress,
): Promise<Blob> {
  const [res, logo, mb] = await Promise.all([fetch(videoUrl), loadLogo(), import("mediabunny")]);
  if (!res.ok) throw new Error(`Video download failed (${res.status})`);
  const source = await res.blob();
  const { Input, Output, Conversion, ALL_FORMATS, BlobSource, BufferTarget, Mp4OutputFormat } = mb;

  const input = new Input({ source: new BlobSource(source), formats: ALL_FORMATS });
  const duration = await input.computeDuration();
  let canvas: OffscreenCanvas | null = null;
  let ctx: OffscreenCanvasRenderingContext2D | null = null;

  const target = new BufferTarget();
  const conversion = await Conversion.init({
    input,
    output: new Output({ format: new Mp4OutputFormat(), target }),
    tags: {},
    video: {
      // H.264 plays in every phone's gallery.
      codec: "avc",
      forceTranscode: true,
      process: (sample) => {
        const w = sample.displayWidth;
        const h = sample.displayHeight;
        if (!canvas || canvas.width !== w || canvas.height !== h) {
          canvas = new OffscreenCanvas(w, h);
          ctx = canvas.getContext("2d");
        }
        if (!ctx) return sample;
        sample.drawWithFit(ctx, { fit: "fill" });
        const corner = sample.timestamp < duration / 2 ? "top-left" : "bottom-right";
        drawMark(ctx, w, h, logo, storeName, corner);
        return canvas;
      },
    },
    audio: {},
  });
  if (!conversion.isValid) throw new Error("This video can't be prepared on this device");
  if (onProgress) conversion.onProgress = (p) => onProgress(p);
  await conversion.execute();
  if (!target.buffer) throw new Error("The video came out empty");
  return new Blob([target.buffer], { type: "video/mp4" });
}

/** Hands the finished video to the phone's save flow. Must run inside a tap
 *  (the share sheet needs a fresh user gesture), so call it from the button
 *  the buyer presses once the video is ready, not straight after encoding. */
export async function saveVideoFile(
  blob: Blob,
  fileName: string,
): Promise<"shared" | "downloaded"> {
  const file = new File([blob], fileName, { type: "video/mp4" });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file] });
    return "shared";
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return "downloaded";
}
