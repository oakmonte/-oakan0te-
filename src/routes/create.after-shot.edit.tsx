import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { X, Check } from "lucide-react";
import { useAfterShotContext } from "./create.after-shot";
import { getVideoKeyframes, snapToNearestKeyframe, trimVideo } from "@/lib/video-trim";

export const Route = createFileRoute("/create/after-shot/edit")({
  head: () => ({ meta: [{ title: "Trim — Oakmonte" }] }),
  component: TrimPage,
});

function TrimPage() {
  const navigate = useNavigate();
  const { media, setMedia } = useAfterShotContext();
  const trackRef = useRef<HTMLDivElement>(null);

  const [duration, setDuration] = useState(0);
  const [keyframes, setKeyframes] = useState<number[]>([]);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [dragging, setDragging] = useState<"start" | "end" | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

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
    return () => { cancelled = true; };
  }, [media, navigate]);

  const timeToRatio = useCallback((t: number) => (duration > 0 ? t / duration : 0), [duration]);
  const ratioToTime = useCallback((r: number) => Math.max(0, Math.min(duration, r * duration)), [duration]);

  const handlePointerMove = useCallback(
    (clientX: number) => {
      if (!dragging || !trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const raw = ratioToTime((clientX - rect.left) / rect.width);
      const snapped = snapToNearestKeyframe(raw, keyframes);
      if (dragging === "start") setStart(Math.min(snapped, end - 0.2));
      else setEnd(Math.max(snapped, start + 0.2));
    },
    [dragging, keyframes, ratioToTime, start, end]
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

  return (
    <div className="fixed inset-0 bg-black text-white overflow-hidden" style={{ fontFamily: "'SF Pro', system-ui, sans-serif" }}>
      <video src={media.url} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover" />

      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+12px)] z-20">
        <button onClick={() => navigate({ to: "/create/after-shot" })} aria-label="Cancel trim" disabled={busy}
          className="flex items-center justify-center w-10 h-10 rounded-full" style={{ background: "rgba(255,255,255,0.10)", backdropFilter: "blur(12px)" }}>
          <X size={20} />
        </button>
        <button onClick={handleConfirm} aria-label="Confirm trim" disabled={busy || duration === 0}
          className="flex items-center justify-center w-10 h-10 rounded-full disabled:opacity-40" style={{ background: "#fff", color: "#000" }}>
          <Check size={20} />
        </button>
      </div>

      {busy && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-30">
          <span className="text-sm uppercase tracking-widest">Trimming… {Math.round(progress * 100)}%</span>
        </div>
      )}

      <div className="absolute left-0 right-0 px-5 z-20" style={{ bottom: "calc(env(safe-area-inset-bottom) + 32px)" }}>
        <div ref={trackRef} className="relative h-12 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }}>
          {keyframes.map((k) => (
            <span key={k} className="absolute top-0 bottom-0 w-px" style={{ left: `${timeToRatio(k) * 100}%`, background: "rgba(255,255,255,0.35)" }} />
          ))}
          <div className="absolute top-0 bottom-0 rounded-full" style={{ left: `${timeToRatio(start) * 100}%`, right: `${100 - timeToRatio(end) * 100}%`, background: "rgba(255,255,255,0.9)", opacity: 0.25 }} />
          <button onPointerDown={() => setDragging("start")} aria-label="Trim start handle"
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full" style={{ left: `${timeToRatio(start) * 100}%`, background: "#fff" }} />
          <button onPointerDown={() => setDragging("end")} aria-label="Trim end handle"
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full" style={{ left: `${timeToRatio(end) * 100}%`, background: "#fff" }} />
        </div>
        <div className="flex justify-between mt-2 text-xs opacity-60 tabular-nums">
          <span>{start.toFixed(1)}s</span>
          <span>{(end - start).toFixed(1)}s selected</span>
          <span>{end.toFixed(1)}s</span>
        </div>
      </div>
    </div>
  );
}