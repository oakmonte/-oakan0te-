import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  X, Check, Play, Volume2, VolumeX,
  Type, Pencil, Sticker, Blend, Link2, Crop,
} from "lucide-react";
import { TrimIcon } from "@/components/camera/aftershot-icons";
import { useAfterShotContext } from "@/lib/after-shot-context";
import { getVideoKeyframes, snapToNearestKeyframe, trimVideo } from "@/lib/video-trim";

export const Route = createFileRoute("/create/after-shot/edit")({
  head: () => ({ meta: [{ title: "Trim — Oakmonte" }] }),
  component: TrimPage,
});

const THUMBNAIL_COUNT = 12;
const THUMB_W = 40;

// Mirrors the tool set on /create/after-shot — this bar is what lets you
// switch edit modes without losing your place, same job TikTok's Edit/Sound/
// Text/Effects/Magic row does. "edit" (this page) is always the active tab;
// the rest aren't wired to their own screens yet, so tapping them just
// drops you back on after-shot where those same icons already live —
// same inert-for-now state, just reachable from one more place.
const EDIT_TABS = [
  { id: "edit", label: "Edit", icon: TrimIcon },
  { id: "sound", label: "Sound", icon: Volume2 },
  { id: "text", label: "Text", icon: Type },
  { id: "draw", label: "Draw", icon: Pencil },
  { id: "stickers", label: "Stickers", icon: Sticker },
  { id: "filters", label: "Filters", icon: Blend },
  { id: "link", label: "Link", icon: Link2 },
  { id: "crop", label: "Crop", icon: Crop },
] as const;

function TrimPage() {
  const navigate = useNavigate();
  const { media, setMedia } = useAfterShotContext();
  const trackRef = useRef<HTMLDivElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const thumbVideoRef = useRef<HTMLVideoElement>(null);

  const [duration, setDuration] = useState(0);
  const [keyframes, setKeyframes] = useState<number[]>([]);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [dragging, setDragging] = useState<"start" | "end" | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [playhead, setPlayhead] = useState(0);

  useEffect(() => {
    if (media.type !== "video") {
      navigate({ to: "/create/after-shot", replace: true });
      return;
    }
    let cancelled = false;
    getVideoKeyframes(media.blob).then(({ duration: d, keyframes: k }) => {
      if (cancelled) return;
      setDuration(d);
      setKeyframes(k);
      setStart(0);
      setEnd(d);
    });
    return () => {
      cancelled = true;
    };
  }, [media, navigate]);

  useEffect(() => {
    if (duration <= 0 || media.type !== "video") return;
    let cancelled = false;
    const videoElement = thumbVideoRef.current;
    if (!videoElement) return;
    const video = videoElement as HTMLVideoElement;

    async function generate() {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const frames: string[] = [];
      const step = duration / THUMBNAIL_COUNT;
      for (let i = 0; i < THUMBNAIL_COUNT; i++) {
        if (cancelled) return;
        const t = Math.min(duration - 0.05, i * step);
        await new Promise<void>((resolve) => {
          const onSeeked = () => {
            video.removeEventListener("seeked", onSeeked);
            resolve();
          };
          video.addEventListener("seeked", onSeeked);
          video.currentTime = t;
        });
        if (cancelled) return;
        const vw = video.videoWidth || 1;
        const vh = video.videoHeight || 1;
        canvas.width = THUMB_W;
        canvas.height = Math.round(THUMB_W * (vh / vw));
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        frames.push(canvas.toDataURL("image/jpeg", 0.6));
      }
      if (!cancelled) setThumbnails(frames);
    }
    generate();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration, media]);

  const timeToRatio = useCallback((t: number) => (duration > 0 ? t / duration : 0), [duration]);
  const ratioToTime = useCallback(
    (r: number) => Math.max(0, Math.min(duration, r * duration)),
    [duration],
  );

  const handlePointerMove = useCallback(
    (clientX: number) => {
      if (!dragging || !trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const raw = ratioToTime((clientX - rect.left) / rect.width);
      const snapped = snapToNearestKeyframe(raw, keyframes);
      if (dragging === "start") setStart(Math.min(snapped, end - 0.2));
      else setEnd(Math.max(snapped, start + 0.2));
    },
    [dragging, keyframes, ratioToTime, start, end],
  );

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => handlePointerMove(e.clientX);
    const onUp = () => setDragging(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, handlePointerMove]);

  useEffect(() => {
    const video = previewVideoRef.current;
    if (!video) return;
    const onTimeUpdate = () => {
      setPlayhead(video.currentTime);
      if (video.currentTime >= end) video.currentTime = start;
    };
    video.addEventListener("timeupdate", onTimeUpdate);
    return () => video.removeEventListener("timeupdate", onTimeUpdate);
  }, [start, end]);

  const togglePlay = useCallback(() => {
    const video = previewVideoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      if (video.currentTime < start || video.currentTime >= end) video.currentTime = start;
      video.play();
      setIsPlaying(true);
    }
  }, [isPlaying, start, end]);

  useEffect(() => {
    if (!dragging) return;
    const video = previewVideoRef.current;
    if (!video) return;
    video.pause();
    setIsPlaying(false);
    video.currentTime = dragging === "start" ? start : end;
  }, [dragging, start, end]);

  const handleConfirm = useCallback(async () => {
    setBusy(true);
    setProgress(0);
    try {
      const trimmedBlob = await trimVideo(media.blob, start, end, setProgress);
      const url = URL.createObjectURL(trimmedBlob);
      setMedia({ type: "video", blob: trimmedBlob, url });
      navigate({ to: "/create/after-shot" });
    } catch (err) {
      console.error("Trim failed:", err);
      setBusy(false);
    }
  }, [media.blob, start, end, setMedia, navigate]);

  const selectedDuration = Math.max(0, end - start);

  return (
    <div
      className="fixed inset-0 bg-black text-white overflow-hidden flex flex-col"
      style={{ fontFamily: "'SF Pro', system-ui, sans-serif" }}
    >
      <style>{`.oak-edit-tabs::-webkit-scrollbar { display: none; }`}</style>

      <video ref={thumbVideoRef} src={media.url} muted playsInline className="hidden" />

      <div className="flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+12px)] z-20">
        <button
          onClick={() => navigate({ to: "/create/after-shot" })}
          aria-label="Cancel trim"
          disabled={busy}
          className="flex items-center justify-center w-10 h-10 rounded-full"
          style={{ background: "rgba(255,255,255,0.10)", backdropFilter: "blur(12px)" }}
        >
          <X size={20} />
        </button>
        <button
          onClick={handleConfirm}
          aria-label="Confirm trim"
          disabled={busy || duration === 0}
          className="flex items-center justify-center w-10 h-10 rounded-full disabled:opacity-40 transition-transform duration-150 active:scale-90"
          style={{ background: "#fff", color: "#000" }}
        >
          <Check size={20} />
        </button>
      </div>

      <div className="relative flex-1 min-h-0 flex items-center justify-center px-5">
        <div
          className="relative overflow-hidden rounded-2xl"
          style={{ maxHeight: "100%", aspectRatio: "9/16", width: "auto", height: "100%" }}
        >
          <video
            ref={previewVideoRef}
            src={media.url}
            muted={muted}
            playsInline
            className="w-full h-full object-cover"
          />
          {busy && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-30">
              <span className="text-sm uppercase tracking-widest">
                Trimming… {Math.round(progress * 100)}%
              </span>
            </div>
          )}
        </div>

        <button
          onClick={togglePlay}
          aria-label="Play preview"
          className="absolute flex items-center justify-center rounded-full transition-opacity duration-150"
          style={{
            width: 56,
            height: 56,
            background: "rgba(0,0,0,0.45)",
            backdropFilter: "blur(8px)",
            opacity: isPlaying ? 0 : 1,
            pointerEvents: isPlaying ? "none" : "auto",
          }}
        >
          <Play size={24} fill="#fff" style={{ marginLeft: 3 }} />
        </button>
      </div>

      <div className="flex items-center justify-between px-5 text-xs opacity-60 tabular-nums" style={{ marginBottom: 10 }}>
        <span>{playhead.toFixed(1)}s</span>
        <button onClick={() => setMuted((m) => !m)} aria-label={muted ? "Unmute" : "Mute"} className="opacity-100">
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
        <span>{selectedDuration.toFixed(1)}s selected</span>
      </div>

      <div className="px-5 z-20">
        <div ref={trackRef} className="relative rounded-xl overflow-hidden" style={{ height: 56, background: "#1a1a1a" }}>
          <div className="absolute inset-0 flex">
            {thumbnails.length > 0 ? (
              thumbnails.map((src, i) => (
                <div
                  key={i}
                  className="h-full flex-1"
                  style={{ backgroundImage: `url(${src})`, backgroundSize: "cover", backgroundPosition: "center" }}
                />
              ))
            ) : (
              <div className="w-full h-full animate-pulse" style={{ background: "#262626" }} />
            )}
          </div>

          <div
            className="absolute top-0 bottom-0 left-0 pointer-events-none"
            style={{ right: `${100 - timeToRatio(start) * 100}%`, background: "rgba(0,0,0,0.65)" }}
          />
          <div
            className="absolute top-0 bottom-0 right-0 pointer-events-none"
            style={{ left: `${timeToRatio(end) * 100}%`, background: "rgba(0,0,0,0.65)" }}
          />

          <div
            className="absolute left-0 right-0 top-0 pointer-events-none"
            style={{ height: 2, background: "#fff", marginLeft: `${timeToRatio(start) * 100}%`, marginRight: `${100 - timeToRatio(end) * 100}%` }}
          />
          <div
            className="absolute left-0 right-0 bottom-0 pointer-events-none"
            style={{ height: 2, background: "#fff", marginLeft: `${timeToRatio(start) * 100}%`, marginRight: `${100 - timeToRatio(end) * 100}%` }}
          />

          {keyframes.map((k) => (
            <span
              key={k}
              className="absolute top-0 bottom-0 w-px pointer-events-none"
              style={{ left: `${timeToRatio(k) * 100}%`, background: "rgba(255,255,255,0.35)" }}
            />
          ))}

          {isPlaying && (
            <div
              className="absolute top-0 bottom-0 w-0.5 pointer-events-none"
              style={{ left: `${timeToRatio(playhead) * 100}%`, background: "#fff" }}
            />
          )}

          <button
            onPointerDown={() => setDragging("start")}
            aria-label="Trim start handle"
            className="absolute top-0 bottom-0 flex items-center justify-center"
            style={{
              left: `${timeToRatio(start) * 100}%`,
              transform: "translateX(-100%)",
              width: 18,
              background: "#fff",
              borderRadius: "8px 0 0 8px",
              cursor: "ew-resize",
            }}
          >
            <span style={{ width: 3, height: 18, background: "#000", borderRadius: 2 }} />
          </button>
          <button
            onPointerDown={() => setDragging("end")}
            aria-label="Trim end handle"
            className="absolute top-0 bottom-0 flex items-center justify-center"
            style={{
              left: `${timeToRatio(end) * 100}%`,
              width: 18,
              background: "#fff",
              borderRadius: "0 8px 8px 0",
              cursor: "ew-resize",
            }}
          >
            <span style={{ width: 3, height: 18, background: "#000", borderRadius: 2 }} />
          </button>
        </div>

        <div className="flex justify-between mt-2 text-xs opacity-60 tabular-nums">
          <span>{start.toFixed(1)}s</span>
          <span>{end.toFixed(1)}s</span>
        </div>
      </div>

      {/* Mode switcher — same job as TikTok's Edit/Sound/Text/Effects/Magic
          row, built from our own tool set instead of theirs. */}
      <div
        className="oak-edit-tabs flex items-start gap-7 overflow-x-auto z-20"
        style={{
          paddingLeft: 20,
          paddingRight: 20,
          paddingTop: 16,
          paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)",
          scrollbarWidth: "none",
        }}
      >
        {EDIT_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === "edit";
          return (
            <button
              key={tab.id}
              onClick={() => {
                if (!isActive) navigate({ to: "/create/after-shot" });
              }}
              aria-label={tab.label}
              aria-current={isActive ? "true" : undefined}
              className="shrink-0 flex flex-col items-center gap-1.5"
              style={{ opacity: isActive ? 1 : 0.55, minWidth: 52 }}
            >
              <Icon size={22} />
              <span className="text-[11px] font-medium whitespace-nowrap">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}