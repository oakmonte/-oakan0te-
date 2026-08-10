export type CropRect = { x: number; y: number; w: number; h: number };

export async function cropPhotoBlob(blob: Blob, rect: CropRect): Promise<Blob> {
  const img = new Image();
  const url = URL.createObjectURL(blob);
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load image for cropping"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(rect.w));
    canvas.height = Math.max(1, Math.round(rect.h));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/jpeg", 0.96);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Re-encodes the video with the crop burned in, frame by frame, via a canvas
// draw loop — the same technique the camera page's own recording path uses
// (draw -> canvas.captureStream -> MediaRecorder), just sourced from an
// already-recorded blob instead of a live camera stream. Original audio is
// carried over by pulling the audio track straight off the source video's
// own captureStream and attaching it to the canvas's stream.
export async function cropVideoBlob(
  blob: Blob,
  rect: CropRect,
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
      video.onerror = () => reject(new Error("Failed to load video for cropping"));
    });

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(rect.w));
    canvas.height = Math.max(1, Math.round(rect.h));
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
      ctx.drawImage(video, rect.x, rect.y, rect.w, rect.h, 0, 0, canvas.width, canvas.height);
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
        reject(new Error("Recording failed during crop"));
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