import { Check } from "lucide-react";
import {
  MAX_STILL_DURATION,
  MIN_STILL_DURATION,
  RATIO_OPTIONS,
  SPEED_OPTIONS,
  type Clip,
  type ClipFit,
  type ProjectRatio,
} from "@/lib/video-sequence";

// The small option sheets the video editor's tool row opens. They share one
// shell so a new one is a list of options rather than another slab of chrome,
// and so they all dismiss the same way — tap the scrim.

export function OptionSheet({
  title,
  note,
  onClose,
  children,
}: {
  title: string;
  note?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-40">
      <div className="absolute inset-0 -top-[100vh]" onClick={onClose} />
      <div
        className="oak-motion-enter relative rounded-t-[14px] px-5 pt-4"
        style={{
          background: "rgba(28,28,30,0.94)",
          backdropFilter: "blur(20px)",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)",
        }}
      >
        <div className="pb-3">
          <span className="text-[14px] font-semibold text-white">{title}</span>
          {note && <p className="pt-1 text-[11px] leading-snug text-white/45">{note}</p>}
        </div>
        {children}
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-full bg-white py-2.5 text-[13px] font-semibold text-black active:scale-[0.98]"
        >
          Done
        </button>
      </div>
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-medium transition-colors active:scale-95 ${
        active ? "bg-white text-black" : "bg-white/[0.12] text-white/80"
      }`}
    >
      {children}
    </button>
  );
}

/** Speed, hold duration and fit for one clip — everything about how it
 *  occupies the frame and the clock, in one place. */
export function ClipSheet({
  clip,
  onPatch,
  onClose,
}: {
  clip: Clip;
  onPatch: (patch: Partial<Clip>) => void;
  onClose: () => void;
}) {
  const isPhoto = clip.kind === "photo";
  return (
    <OptionSheet
      title={isPhoto ? "Photo" : "Clip"}
      note={
        !isPhoto && clip.speed !== 1
          ? "Sound is dropped at anything other than 1x — re-timing audio without resampling it would come out distorted."
          : undefined
      }
      onClose={onClose}
    >
      {isPhoto ? (
        <div className="py-1">
          <div className="flex items-center justify-between pb-1.5">
            <span className="text-[12px] text-white/60">Hold for</span>
            <span className="text-[12px] font-medium tabular-nums text-white">
              {clip.stillDuration.toFixed(1)}s
            </span>
          </div>
          <input
            type="range"
            min={MIN_STILL_DURATION}
            max={MAX_STILL_DURATION}
            step={0.1}
            value={clip.stillDuration}
            onChange={(e) => onPatch({ stillDuration: Number(e.target.value) })}
            aria-label="Photo duration"
            className="oak-adjust-range w-full"
          />
        </div>
      ) : (
        <div className="py-1">
          <span className="text-[12px] text-white/60">Speed</span>
          <div className="flex gap-2 overflow-x-auto pt-2 pb-1" style={{ scrollbarWidth: "none" }}>
            {SPEED_OPTIONS.map((s) => (
              <Pill key={s} active={clip.speed === s} onClick={() => onPatch({ speed: s })}>
                {s}x
              </Pill>
            ))}
          </div>
        </div>
      )}

      <div className="pt-3">
        <span className="text-[12px] text-white/60">Fill the frame</span>
        <div className="flex gap-2 pt-2">
          {(["cover", "contain"] as ClipFit[]).map((fit) => (
            <Pill key={fit} active={clip.fit === fit} onClick={() => onPatch({ fit })}>
              {fit === "cover" ? "Fill" : "Fit"}
            </Pill>
          ))}
        </div>
      </div>
    </OptionSheet>
  );
}

/** The project's aspect ratio. Every clip is fitted into this, which is what
 *  lets a portrait video and a square photo live in the same file. */
export function RatioSheet({
  ratio,
  onChange,
  onClose,
}: {
  ratio: ProjectRatio;
  onChange: (r: ProjectRatio) => void;
  onClose: () => void;
}) {
  return (
    <OptionSheet
      title="Canvas"
      note="Every clip is fitted into this shape when the video is made."
      onClose={onClose}
    >
      <div className="flex gap-2">
        {RATIO_OPTIONS.map((r) => (
          <Pill key={r.id} active={ratio === r.id} onClick={() => onChange(r.id)}>
            {r.label}
          </Pill>
        ))}
      </div>
    </OptionSheet>
  );
}

/** Transitions are drawn but not yet applied — the encoder writes clips
 *  end-to-end, and cross-fading means compositing two decoders at once. The
 *  sheet says so rather than letting someone pick a dissolve and find a hard
 *  cut in the finished file. */
const TRANSITIONS = ["None", "Dissolve", "Whip", "Flash", "Slide", "Zoom"];

export function TransitionSheet({ onClose }: { onClose: () => void }) {
  return (
    <OptionSheet
      title="Transition"
      note="Not wired up yet — clips still join on a hard cut. Pick one and it will apply once transitions land."
      onClose={onClose}
    >
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {TRANSITIONS.map((t, i) => (
          <Pill key={t} active={i === 0} onClick={() => {}}>
            {t}
          </Pill>
        ))}
      </div>
    </OptionSheet>
  );
}

/** Shared shell for the tools that exist as icons but have nothing behind them
 *  yet. Saying which is which beats a button that silently does nothing. */
export function ComingSoonSheet({
  title,
  body,
  onClose,
}: {
  title: string;
  body: string;
  onClose: () => void;
}) {
  return (
    <OptionSheet title={title} onClose={onClose}>
      <div className="flex items-start gap-3 rounded-xl bg-white/[0.07] px-4 py-3.5">
        <Check size={16} className="mt-[2px] shrink-0 text-white/40" />
        <p className="text-[12px] leading-relaxed text-white/65">{body}</p>
      </div>
    </OptionSheet>
  );
}
