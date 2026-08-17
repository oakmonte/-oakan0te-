import { compileFilter, applyCompiledFilter, IDENTITY_FILTER } from "@/lib/canvas-filter";

export async function applyFilterToPhotoBlob(blob: Blob, filterCss: string): Promise<Blob> {
  const img = new Image();
  const url = URL.createObjectURL(blob);
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load image for filtering"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.drawImage(img, 0, 0);

    const compiled = compileFilter(filterCss);
    if (compiled !== IDENTITY_FILTER) {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      applyCompiledFilter(imgData, compiled);
      ctx.putImageData(imgData, 0, 0);
    }

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
        "image/jpeg",
        0.96,
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Same draw-loop + MediaRecorder re-encode as crop-media.ts's cropVideoBlob
// — full frame here (no crop rect), filter baked in per-frame via the same
// getImageData/applyCompiledFilter/putImageData round-trip capturePhoto and
// startRecording already use on the camera page.
export async function applyFilterToVideoBlob(
  blob: Blob,
  filterCss: string,
  onProgress?: (ratio: number) => void,
): Promise<Blob> {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  const url = URL.createObjectURL(blob);
  video.src = url;

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Failed to load video for filtering"));
    });

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");

    const compiled = compileFilter(filterCss);

    const sourceStream = (
      video as HTMLVideoElement & { captureStream: () => MediaStream }
    ).captureStream();
    const audioTracks = sourceStream.getAudioTracks();

    const canvasStream = canvas.captureStream(30);
    audioTracks.forEach((t) => canvasStream.addTrack(t));

    const candidates = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
      "video/mp4",
    ];
    const mimeType = candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
    const recorder = new MediaRecorder(canvasStream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    let rafId: number | null = null;
    const drawFrame = () => {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      if (compiled !== IDENTITY_FILTER) {
        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
        applyCompiledFilter(frame, compiled);
        ctx.putImageData(frame, 0, 0);
      }
      if (onProgress && video.duration > 0)
        onProgress(Math.min(1, video.currentTime / video.duration));
      rafId = requestAnimationFrame(drawFrame);
    };

    return await new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => {
        if (rafId !== null) cancelAnimationFrame(rafId);
        resolve(new Blob(chunks, { type: mimeType || "video/webm" }));
      };
      recorder.onerror = () => {
        if (rafId !== null) cancelAnimationFrame(rafId);
        reject(new Error("Recording failed during filter apply"));
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
