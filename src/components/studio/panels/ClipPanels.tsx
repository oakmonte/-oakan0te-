import { Gauge, Trash2, VolumeX, Volume2, Link2 } from "lucide-react";
import { EmptyHint, Pill, StudioSheet, StudioSlider } from "../controls";
import {
  MAX_SPEED,
  MIN_SPEED,
  SPEED_PRESETS,
  TRANSITION_PRESETS,
  type AudioClip,
  type VideoClip,
} from "@/lib/studio/types";
import { RAMP_SPEED, RAMP_WINDOW } from "@/lib/studio/project";

type Group = { begin: () => void; end: () => void };

export function SpeedPanel({
  clip,
  onSpeed,
  onRevealRamp,
  onDone,
  group,
}: {
  clip: VideoClip | null;
  onSpeed: (speed: number) => void;
  onRevealRamp: () => void;
  onDone: () => void;
  group: Group;
}) {
  if (!clip) {
    return (
      <StudioSheet title="Speed" onDone={onDone}>
        <EmptyHint>Select a clip first.</EmptyHint>
      </StudioSheet>
    );
  }
  return (
    <StudioSheet title="Speed" onDone={onDone} onReset={() => onSpeed(1)}>
      <div className="flex gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden">
        {SPEED_PRESETS.map((s) => (
          <Pill key={s} active={clip.speed === s} onClick={() => onSpeed(s)}>
            {s}x
          </Pill>
        ))}
      </div>
      <StudioSlider
        label="Fine"
        value={clip.speed}
        min={MIN_SPEED}
        max={MAX_SPEED}
        step={0.05}
        suffix="x"
        onChange={onSpeed}
        onCommitStart={group.begin}
        onCommitEnd={group.end}
      />
      {/* The shot every Oakmonte seller is actually trying to cut: normal speed
          into the turn, slow through the reveal, normal out. Three splits and
          two speed changes, as one tap. */}
      <button
        onClick={onRevealRamp}
        className="mt-1 mb-2 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-[12px] font-semibold active:scale-[0.98]"
        style={{ background: "rgba(255,255,255,0.10)" }}
      >
        <Gauge size={15} />
        Reveal ramp — {RAMP_WINDOW}s at {RAMP_SPEED}x around the playhead
      </button>
    </StudioSheet>
  );
}

export function ClipVolumePanel({
  clip,
  onVolume,
  onToggleMute,
  onDetach,
  onDone,
  group,
  canDetach,
}: {
  clip: VideoClip | null;
  onVolume: (v: number) => void;
  onToggleMute: () => void;
  onDetach: () => void;
  onDone: () => void;
  group: Group;
  canDetach: boolean;
}) {
  if (!clip) {
    return (
      <StudioSheet title="Volume" onDone={onDone}>
        <EmptyHint>Select a clip first.</EmptyHint>
      </StudioSheet>
    );
  }
  return (
    <StudioSheet title="Clip sound" onDone={onDone} onReset={() => onVolume(1)}>
      {clip.audioDetached ? (
        <EmptyHint>
          This clip&rsquo;s sound is on its own track — select the blue chip to edit it.
        </EmptyHint>
      ) : (
        <StudioSlider
          label="Volume"
          value={Math.round(clip.volume * 100)}
          min={0}
          max={200}
          suffix="%"
          onChange={(v) => onVolume(v / 100)}
          onCommitStart={group.begin}
          onCommitEnd={group.end}
        />
      )}
      <div className="flex gap-2 overflow-x-auto py-2 [&::-webkit-scrollbar]:hidden">
        <Pill active={clip.muted} onClick={onToggleMute}>
          {clip.muted ? "Unmute" : "Mute"}
        </Pill>
        <Pill onClick={onDetach} disabled={!canDetach || clip.audioDetached}>
          Separate audio
        </Pill>
      </div>
      {!canDetach && <EmptyHint>This clip has no audio track to separate.</EmptyHint>}
    </StudioSheet>
  );
}

export function AudioClipPanel({
  audio,
  onPatch,
  onDelete,
  onReattach,
  onDone,
  group,
}: {
  audio: AudioClip;
  onPatch: (patch: Partial<AudioClip>) => void;
  onDelete: () => void;
  onReattach: () => void;
  onDone: () => void;
  group: Group;
}) {
  const length = (audio.outPoint - audio.inPoint) / audio.speed;
  return (
    <StudioSheet
      title={audio.kind === "detached" ? "Separated audio" : "Audio track"}
      onDone={onDone}
    >
      <StudioSlider
        label="Volume"
        value={Math.round(audio.volume * 100)}
        min={0}
        max={200}
        suffix="%"
        onChange={(v) => onPatch({ volume: v / 100, muted: false })}
        onCommitStart={group.begin}
        onCommitEnd={group.end}
      />
      <div className="grid grid-cols-2 gap-3">
        <StudioSlider
          label="Fade in"
          value={Number(audio.fadeIn.toFixed(2))}
          min={0}
          max={Math.max(0.1, length / 2)}
          step={0.05}
          suffix="s"
          onChange={(v) => onPatch({ fadeIn: v })}
          onCommitStart={group.begin}
          onCommitEnd={group.end}
        />
        <StudioSlider
          label="Fade out"
          value={Number(audio.fadeOut.toFixed(2))}
          min={0}
          max={Math.max(0.1, length / 2)}
          step={0.05}
          suffix="s"
          onChange={(v) => onPatch({ fadeOut: v })}
          onCommitStart={group.begin}
          onCommitEnd={group.end}
        />
      </div>
      <StudioSlider
        label="Start at"
        value={Number(audio.timelineStart.toFixed(2))}
        min={0}
        max={Math.max(0.1, audio.timelineStart + length + 5)}
        step={0.05}
        suffix="s"
        onChange={(v) => onPatch({ timelineStart: v })}
        onCommitStart={group.begin}
        onCommitEnd={group.end}
      />
      <div className="flex gap-2 overflow-x-auto py-2 [&::-webkit-scrollbar]:hidden">
        <Pill active={audio.muted} onClick={() => onPatch({ muted: !audio.muted })}>
          {audio.muted ? <Volume2 size={13} /> : <VolumeX size={13} />}
        </Pill>
        {audio.kind === "detached" && (
          <Pill onClick={onReattach}>
            <span className="flex items-center gap-1">
              <Link2 size={13} /> Re-attach
            </span>
          </Pill>
        )}
        <Pill tone="danger" onClick={onDelete}>
          <span className="flex items-center gap-1">
            <Trash2 size={13} /> Delete
          </span>
        </Pill>
      </div>
    </StudioSheet>
  );
}

export function TransitionPanel({
  clip,
  onSet,
  onDone,
  group,
}: {
  clip: VideoClip | null;
  onSet: (kind: string, duration: number) => void;
  onDone: () => void;
  group: Group;
}) {
  if (!clip) {
    return (
      <StudioSheet title="Transition" onDone={onDone}>
        <EmptyHint>Tap the marker on a cut to add a transition.</EmptyHint>
      </StudioSheet>
    );
  }
  const current = clip.transitionIn;
  return (
    <StudioSheet title="Transition" onDone={onDone} onReset={() => onSet("none", 0)}>
      <div className="flex gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden">
        {TRANSITION_PRESETS.map((preset) => (
          <Pill
            key={preset.kind}
            active={current.kind === preset.kind}
            onClick={() =>
              onSet(preset.kind, preset.duration || (current.duration ?? preset.duration))
            }
          >
            {preset.label}
          </Pill>
        ))}
      </div>
      {current.kind !== "none" && (
        <StudioSlider
          label="Length"
          value={Number(current.duration.toFixed(2))}
          min={0.1}
          max={1}
          step={0.05}
          suffix="s"
          onChange={(v) => onSet(current.kind, v)}
          onCommitStart={group.begin}
          onCommitEnd={group.end}
        />
      )}
      <p className="pb-2 text-[11px] leading-snug text-white/40">
        Transitions sit across the cut and keep the timeline the same length — the outgoing clip
        holds its last frame while the incoming one arrives.
      </p>
    </StudioSheet>
  );
}
