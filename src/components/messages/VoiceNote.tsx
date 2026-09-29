import { useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2, Pause, Play } from "lucide-react";
import { formatDuration, type ChatMessage } from "@/lib/chat/model";
import { useMediaUrl } from "./use-media-url";

const SPEEDS = [1, 1.5, 2] as const;

// Only one voice note plays at a time, like every messenger: starting one
// pauses whichever was playing.
let playing: HTMLAudioElement | null = null;

export function VoiceNote({
  message,
  mine,
  stamp,
}: {
  message: ChatMessage;
  mine: boolean;
  /** Time and ticks, laid out in the same row as the duration and speed so
   *  the three never stack on top of each other. */
  stamp?: ReactNode;
}) {
  const url = useMediaUrl(message.mediaPath, message.localUrl);
  const audio = useRef<HTMLAudioElement>(null);
  const [isPlaying, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [current, setCurrent] = useState(0);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [waiting, setWaiting] = useState(false);
  const duration = message.meta.duration ?? 0;
  const bars = message.meta.waveform?.length ? message.meta.waveform : Array(40).fill(0.2);

  useEffect(() => {
    const node = audio.current;
    if (node) node.playbackRate = speed;
  }, [speed]);

  // Stop on unmount: the copy in the long-press menu goes away with the menu,
  // and a detached <audio> isn't reliably paused by every browser.
  useEffect(() => {
    const node = audio.current;
    return () => {
      node?.pause();
      if (playing === node) playing = null;
    };
  }, [url]);

  const toggle = async () => {
    const node = audio.current;
    if (!node || !url) return;
    if (!node.paused) {
      node.pause();
      return;
    }
    if (playing && playing !== node) playing.pause();
    playing = node;
    node.playbackRate = speed;
    setWaiting(true);
    try {
      await node.play();
    } catch {
      /* autoplay refusal or a decode error; the button just stays on play */
    } finally {
      setWaiting(false);
    }
  };

  const seek = (event: React.PointerEvent<HTMLDivElement>) => {
    const node = audio.current;
    if (!node) return;
    const total = Number.isFinite(node.duration) && node.duration > 0 ? node.duration : duration;
    if (!total) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    node.currentTime = ratio * total;
    setProgress(ratio);
  };

  const tone = mine ? "text-chat-inverse" : "text-chat-text";
  const filled = mine ? "bg-chat-inverse" : "bg-chat-accent";
  const empty = mine ? "bg-chat-inverse/35" : "bg-chat-text/25";

  return (
    <div className={`flex w-[236px] items-center gap-2.5 ${tone}`}>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          void toggle();
        }}
        onPointerDown={(event) => event.stopPropagation()}
        aria-label={isPlaying ? "Pause voice message" : "Play voice message"}
        disabled={!url}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full active:scale-95 disabled:opacity-50 ${
          mine ? "bg-chat-inverse/15" : "bg-chat-accent text-white"
        }`}
      >
        {waiting || !url ? (
          <Loader2 size={18} className="animate-spin" />
        ) : isPlaying ? (
          <Pause size={18} className="fill-current" />
        ) : (
          <Play size={18} className="ml-0.5 fill-current" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          tabIndex={0}
          onPointerDown={(event) => {
            event.stopPropagation();
            seek(event);
          }}
          className="flex h-7 cursor-pointer items-center gap-[2px]"
        >
          {bars.map((level, index) => (
            <span
              key={index}
              className={`w-[3px] flex-1 rounded-full ${index / bars.length < progress ? filled : empty}`}
              style={{ height: `${Math.max(12, level * 100)}%` }}
            />
          ))}
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[12px] tabular-nums opacity-70">
              {formatDuration(isPlaying || current > 0 ? current : duration)}
            </span>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]);
              }}
              onPointerDown={(event) => event.stopPropagation()}
              className={`flex h-7 min-w-[42px] items-center justify-center rounded-full px-2 text-[12.5px] font-semibold tabular-nums leading-none active:scale-95 ${
                mine ? "bg-chat-inverse/12" : "bg-chat-text/10"
              }`}
              aria-label={`Playback speed ${speed}x`}
            >
              {speed}×
            </button>
          </div>
          {stamp}
        </div>
      </div>
      {url && (
        <audio
          ref={audio}
          src={url}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            setProgress(0);
            setCurrent(0);
          }}
          onTimeUpdate={(event) => {
            const node = event.currentTarget;
            const total =
              Number.isFinite(node.duration) && node.duration > 0 ? node.duration : duration;
            setCurrent(node.currentTime);
            if (total) setProgress(node.currentTime / total);
          }}
        />
      )}
    </div>
  );
}
