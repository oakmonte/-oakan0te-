import { NEUTRAL_ADJUST, type PhotoAdjust } from "@/lib/photo-adjust";

// The data model for the video editor — a single timeline of clips that
// becomes ONE video.
//
// The distinction that matters: the photo editor produces a carousel, where
// every image stays its own thing. This produces a sequence, where a photo is
// just a clip that happens to hold still. So a photo and a video are the same
// shape here, differing only in where their duration comes from — a photo's is
// chosen (`stillDuration`), a video's is trimmed out of what it already has
// (`trimStart`/`trimEnd`, divided by `speed`).
//
// Everything is intent, nothing is baked. The blob stays the untouched
// original for the life of the session, exactly as the after-shot screen keeps
// its capture, so auditioning six filters costs zero generations of re-encode.
// The single composite happens once, in video-sequence-export.ts.

export type ClipKind = "video" | "photo";

/** How a clip fills the project frame when its shape doesn't match. */
export type ClipFit = "cover" | "contain";

export type Clip = {
  id: string;
  kind: ClipKind;
  /** The untouched source. An empty Blob until a remote clip is fetched for
   *  export — browsing only ever needs `url`. */
  blob: Blob;
  url: string;
  remote: boolean;
  naturalSize: { w: number; h: number } | null;
  /** Video only: the full length of the source, before trimming. */
  sourceDuration: number;
  /** Video only: the window kept, in SOURCE seconds (before speed). */
  trimStart: number;
  trimEnd: number;
  /** Photo only: how long it holds the screen. */
  stillDuration: number;
  /** Video only. A clip at anything but 1x exports silent — see
   *  video-sequence-export.ts for why. */
  speed: number;
  muted: boolean;
  fit: ClipFit;
  filterId: string;
  filterIntensity: number;
  adjust: PhotoAdjust;
  /** Poster frame. Also the timeline's fallback until the filmstrip arrives. */
  thumbUrl: string | null;
  /** Frames along the clip's length, for the timeline strip. Fills in
   *  progressively after the clip is added; empty is a valid state. */
  frames: ClipFrame[];
};

/** One frame of a clip's filmstrip, and the span of SOURCE time it stands for.
 *
 *  Source time, not timeline time, is the point: trimming and speed change
 *  where a frame lands on the strip but not which frame it is, so a trim drag
 *  re-positions what's already decoded instead of decoding again. */
export type ClipFrame = {
  start: number;
  end: number;
  url: string;
};

export const MIN_CLIP_DURATION = 0.3;

/** How long a photo dropped on the timeline holds the frame.
 *
 *  A still is not a clip with a length of its own, so something has to choose
 *  one, and this is a garment being looked at rather than a cut in a montage:
 *  five seconds is long enough to read a neckline or a hem, where three is
 *  over before the eye has finished arriving. Anyone who wants a quicker cut
 *  drags the handle — the slider runs from MIN_STILL_DURATION to
 *  MAX_STILL_DURATION and this is only where it starts. */
export const DEFAULT_STILL_DURATION = 5;
export const MIN_STILL_DURATION = 0.5;
export const MAX_STILL_DURATION = 15;
export const SPEED_OPTIONS = [0.25, 0.5, 1, 2, 3, 4] as const;

export type ProjectRatio = "9:16" | "1:1" | "4:5" | "16:9";

export const RATIO_OPTIONS: { id: ProjectRatio; label: string; value: number }[] = [
  { id: "9:16", label: "9:16", value: 9 / 16 },
  { id: "4:5", label: "4:5", value: 4 / 5 },
  { id: "1:1", label: "1:1", value: 1 },
  { id: "16:9", label: "16:9", value: 16 / 9 },
];

export function ratioValue(ratio: ProjectRatio): number {
  return RATIO_OPTIONS.find((r) => r.id === ratio)?.value ?? 9 / 16;
}

/** Encode size for a project ratio. Capped so the long edge is 1920 — a phone
 *  encoding 4K in a browser tab is how you get a tab the OS kills halfway. */
export function outputSize(ratio: ProjectRatio): { width: number; height: number } {
  switch (ratio) {
    case "1:1":
      return { width: 1080, height: 1080 };
    case "4:5":
      return { width: 1080, height: 1350 };
    case "16:9":
      return { width: 1920, height: 1080 };
    default:
      return { width: 1080, height: 1920 };
  }
}

export function newClipId(): string {
  return `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** How long this clip occupies the finished video. Speed divides a video's
 *  trimmed window; a photo has no source to speed up, so it ignores it. */
export function clipDuration(clip: Clip): number {
  if (clip.kind === "photo") return clip.stillDuration;
  const window = Math.max(0, clip.trimEnd - clip.trimStart);
  return window / (clip.speed || 1);
}

export function sequenceDuration(clips: Clip[]): number {
  return clips.reduce((total, clip) => total + clipDuration(clip), 0);
}

/** Timeline start time of every clip, plus the total as a final entry — so
 *  `starts[i]` and `starts[i + 1]` bracket clip `i` without a special case for
 *  the last one. */
export function clipStarts(clips: Clip[]): number[] {
  const starts: number[] = [0];
  for (const clip of clips) starts.push(starts[starts.length - 1] + clipDuration(clip));
  return starts;
}

export type Playhead = {
  index: number;
  /** Seconds into the clip's own timeline (already speed-scaled). */
  local: number;
  /** Seconds into the SOURCE media — what you seek a <video> element to. */
  source: number;
};

/** Which clip is on screen at timeline time `t`, and where inside it. Returns
 *  null only for an empty sequence. Times past the end clamp to the last
 *  frame rather than falling off, because a scrubber that can reach the very
 *  end shouldn't go blank there. */
export function locate(clips: Clip[], t: number): Playhead | null {
  if (clips.length === 0) return null;
  const starts = clipStarts(clips);
  const total = starts[starts.length - 1];
  const clamped = Math.max(0, Math.min(t, total));
  let index = clips.findIndex((_, i) => clamped < starts[i + 1]);
  if (index === -1) index = clips.length - 1;
  const clip = clips[index];
  const local = Math.max(0, Math.min(clamped - starts[index], clipDuration(clip)));
  const source = clip.kind === "photo" ? 0 : clip.trimStart + local * (clip.speed || 1);
  return { index, local, source };
}

/** Split a clip at `local` seconds into it. Returns the two halves, or null if
 *  the cut would leave a sliver on either side. A photo splits by duration; a
 *  video splits by trim window, so neither half re-decodes anything. */
export function splitClip(clip: Clip, local: number): [Clip, Clip] | null {
  const total = clipDuration(clip);
  if (local < MIN_CLIP_DURATION || total - local < MIN_CLIP_DURATION) return null;

  if (clip.kind === "photo") {
    return [
      { ...clip, id: newClipId(), stillDuration: local },
      { ...clip, id: newClipId(), stillDuration: total - local },
    ];
  }

  const cut = clip.trimStart + local * (clip.speed || 1);
  return [
    { ...clip, id: newClipId(), trimEnd: cut },
    { ...clip, id: newClipId(), trimStart: cut },
  ];
}

export function moveClip(clips: Clip[], from: number, to: number): Clip[] {
  if (from === to || from < 0 || to < 0 || from >= clips.length || to >= clips.length) {
    return clips;
  }
  const next = clips.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** `0:07`, or `1:02:30` once an hour is involved. The transport row reads this
 *  many times a second, so it stays allocation-light. */
export function formatTime(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const total = Math.floor(safe);
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

/** Source and destination rects for drawing `src` into `dst` under a fit mode.
 *  CSS does this for the preview via object-fit; the export canvas has to be
 *  told, and both have to agree or the exported frame won't match what was
 *  approved on screen. */
export function fitRect(
  src: { w: number; h: number },
  dst: { w: number; h: number },
  fit: ClipFit,
): {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
} {
  if (src.w <= 0 || src.h <= 0) {
    return { sx: 0, sy: 0, sw: 1, sh: 1, dx: 0, dy: 0, dw: dst.w, dh: dst.h };
  }
  if (fit === "cover") {
    // Crop the source to the destination's shape, centred.
    const scale = Math.max(dst.w / src.w, dst.h / src.h);
    const sw = dst.w / scale;
    const sh = dst.h / scale;
    return {
      sx: (src.w - sw) / 2,
      sy: (src.h - sh) / 2,
      sw,
      sh,
      dx: 0,
      dy: 0,
      dw: dst.w,
      dh: dst.h,
    };
  }
  // Contain: whole source, letterboxed inside the destination.
  const scale = Math.min(dst.w / src.w, dst.h / src.h);
  const dw = src.w * scale;
  const dh = src.h * scale;
  return {
    sx: 0,
    sy: 0,
    sw: src.w,
    sh: src.h,
    dx: (dst.w - dw) / 2,
    dy: (dst.h - dh) / 2,
    dw,
    dh,
  };
}

/** A poster frame for the timeline strip, as an object URL the caller owns.
 *
 *  Deliberately a plain <video> seek rather than a mediabunny decode: this runs
 *  once per clip added, on the main thread, while the user is looking at the
 *  screen — the browser's own decoder is both faster to reach and cheaper here
 *  than spinning up the full demuxer for one frame. */
export function videoThumbnail(
  url: string,
  at = 0,
): Promise<{ url: string; w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.crossOrigin = "anonymous";

    const fail = () => reject(new Error("Couldn't read that video"));
    let settled = false;

    const grab = () => {
      if (settled) return;
      settled = true;
      try {
        const canvas = document.createElement("canvas");
        const w = video.videoWidth;
        const h = video.videoHeight;
        canvas.width = Math.max(1, Math.round((120 * w) / Math.max(1, h)));
        canvas.height = 120;
        const ctx = canvas.getContext("2d");
        if (!ctx) return fail();
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (!blob) return fail();
            resolve({ url: URL.createObjectURL(blob), w, h });
          },
          "image/jpeg",
          0.7,
        );
      } catch {
        fail();
      }
    };

    video.onloadedmetadata = () => {
      // Seeking to exactly 0 lands before the first decoded frame on some
      // builds and paints black; a hair in is reliably a real frame.
      video.currentTime = Math.min(Math.max(at, 0.04), Math.max(0.04, video.duration - 0.05));
    };
    video.onseeked = grab;
    video.onerror = fail;
    video.src = url;
  });
}

/** How long a video actually is.
 *
 *  Not just `video.duration`, because the format this app produces most is the
 *  one that reports it worst: a `MediaRecorder` webm carries no duration in its
 *  header, so the element says `Infinity` until it has seen the last frame.
 *  Seeking past the end forces the browser to scan for it — the long-standing
 *  workaround, and the reason a clip recorded in our own camera doesn't land
 *  here as a zero-length blip. */
export function videoDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;

    const done = (value: number) => {
      video.onloadedmetadata = null;
      video.ontimeupdate = null;
      video.onerror = null;
      resolve(Number.isFinite(value) && value > 0 ? value : 0);
    };

    video.onloadedmetadata = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) return done(video.duration);
      video.ontimeupdate = () => {
        video.ontimeupdate = null;
        done(video.duration);
      };
      video.currentTime = 1e101;
    };
    video.onerror = () => done(0);
    video.src = url;
  });
}

/** Roughly how much source time one filmstrip frame covers, and the ceiling on
 *  how many are decoded for a single clip.
 *
 *  Both exist to bound the cost. Every frame is a seek plus a decode plus a
 *  JPEG encode on the main thread, so a long clip samples more coarsely rather
 *  than doing proportionally more work — 24 frames is enough to read a clip's
 *  content at a glance whether it's eight seconds or eighty. */
const FILMSTRIP_SECONDS_PER_FRAME = 1.1;
const FILMSTRIP_MAX_FRAMES = 24;
const FILMSTRIP_HEIGHT = 128;

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      video.removeEventListener("seeked", done);
      resolve();
    };
    video.addEventListener("seeked", done);
    video.currentTime = time;
  });
}

/** Decode frames along a video and hand them back one at a time.
 *
 *  Progressive by design: the strip fills in left to right while the user is
 *  already looking at it, instead of showing a placeholder until every frame
 *  is ready. Decoding is sequential — one seek, one draw, one encode — because
 *  running several at once on a phone is how you drop the frame rate of the
 *  editor the strip belongs to.
 *
 *  A plain <video> rather than a mediabunny decode, for the same reason
 *  `videoThumbnail` is: the browser's own decoder is already warm for a file
 *  the page is playing, and this runs while the user waits. */
export async function extractFilmstrip(
  url: string,
  duration: number,
  onFrame: (frame: ClipFrame) => void,
  isCancelled: () => boolean = () => false,
): Promise<void> {
  if (!(duration > 0)) return;

  const count = Math.max(
    1,
    Math.min(FILMSTRIP_MAX_FRAMES, Math.round(duration / FILMSTRIP_SECONDS_PER_FRAME)),
  );
  const span = duration / count;

  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.crossOrigin = "anonymous";

  await new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve();
    video.onerror = () => reject(new Error("Couldn't read that video"));
    video.src = url;
  });

  const canvas = document.createElement("canvas");
  const aspect = video.videoWidth / Math.max(1, video.videoHeight);
  canvas.height = FILMSTRIP_HEIGHT;
  canvas.width = Math.max(1, Math.round(FILMSTRIP_HEIGHT * aspect));
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  for (let i = 0; i < count; i++) {
    if (isCancelled()) return;
    const start = i * span;
    // Sampled from the middle of the span it represents, so a frame is typical
    // of its slice rather than of the cut that begins it.
    await seekTo(video, Math.min(start + span / 2, duration - 0.02));
    if (isCancelled()) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.6),
    );
    if (!blob) continue;
    if (isCancelled()) return;
    onFrame({ start, end: start + span, url: URL.createObjectURL(blob) });
  }
}

export function blankClipEdits() {
  return {
    naturalSize: null,
    sourceDuration: 0,
    trimStart: 0,
    trimEnd: 0,
    stillDuration: DEFAULT_STILL_DURATION,
    speed: 1,
    muted: false,
    // Fit, not fill. A clip whose shape already matches the project looks
    // identical either way, so this only decides what happens to one that
    // doesn't — and silently cropping someone's landscape footage to a
    // portrait frame throws away picture they never agreed to lose. Fill is
    // one tap away in the clip sheet when the crop is what they want.
    fit: "contain" as ClipFit,
    filterId: "natural",
    filterIntensity: 100,
    adjust: NEUTRAL_ADJUST,
    thumbUrl: null,
    frames: [] as ClipFrame[],
  };
}
