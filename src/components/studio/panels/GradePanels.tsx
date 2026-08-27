import { useState } from "react";
import {
  CAMERA_FILTERS,
  FILTER_CATEGORIES,
  type CameraFilter,
} from "@/components/camera/filter-data";
import { ADJUSTMENT_CONTROLS, resetAdjustments } from "@/lib/studio/adjustments";
import { useFilterThumbnail } from "@/lib/filter-thumbnail";
import { EmptyHint, Pill, StudioSheet, StudioSlider } from "../controls";
import type { Adjustments, VideoClip } from "@/lib/studio/types";

function FilterSwatch({ filter, active }: { filter: CameraFilter; active: boolean }) {
  const thumb = useFilterThumbnail(filter);
  return (
    <span
      className="block h-12 w-12 rounded-lg bg-cover bg-center"
      style={{
        backgroundColor: filter.thumbnailColor,
        backgroundImage: thumb ? `url(${thumb})` : undefined,
        outline: active ? "2px solid #fff" : "1px solid rgba(255,255,255,0.15)",
        outlineOffset: 1,
      }}
    />
  );
}

type Group = { begin: () => void; end: () => void };

export function FilterPanel({
  clip,
  onPick,
  onPreview,
  onApplyAll,
  onDone,
}: {
  clip: VideoClip | null;
  onPick: (filterId: string) => void;
  onPreview: (filterId: string | null) => void;
  onApplyAll: (filterId: string) => void;
  onDone: () => void;
}) {
  const [category, setCategory] = useState<string>("portrait");

  if (!clip) {
    return (
      <StudioSheet title="Filters" onDone={onDone}>
        <EmptyHint>Select a clip first.</EmptyHint>
      </StudioSheet>
    );
  }

  const filters = CAMERA_FILTERS.filter((f) => f.category === category);

  return (
    <StudioSheet
      title="Filters"
      onDone={() => {
        onPreview(null);
        onDone();
      }}
      onReset={() => onPick("natural")}
    >
      <div className="flex gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden">
        {FILTER_CATEGORIES.filter((c) => c !== "favorites").map((c) => (
          <Pill key={c} active={category === c} onClick={() => setCategory(c)}>
            {c === "bw" ? "B&W" : c[0].toUpperCase() + c.slice(1)}
          </Pill>
        ))}
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden">
        {filters.map((f) => (
          <button
            key={f.id}
            // Press-and-hold to audition, release to commit. It used to be
            // pointerenter/leave, which is a hover contract: on a touchscreen
            // enter fires on tap-down and leave on lift, so the audition the
            // comment promised lasted exactly as long as the tap and nobody on
            // a phone ever saw it. Down/up says the same thing in a language
            // touch actually speaks.
            onPointerDown={() => onPreview(f.id)}
            onPointerUp={() => onPreview(null)}
            onPointerCancel={() => onPreview(null)}
            onPointerLeave={() => onPreview(null)}
            onClick={() => {
              onPick(f.id);
              onPreview(null);
            }}
            className="flex shrink-0 flex-col items-center gap-1"
          >
            <FilterSwatch filter={f} active={clip.filterId === f.id} />
            <span className="text-[9px] text-white/70">{f.name}</span>
          </button>
        ))}
      </div>

      <div className="pb-2">
        <Pill onClick={() => onApplyAll(clip.filterId)}>Apply to all clips</Pill>
      </div>
    </StudioSheet>
  );
}

export function AdjustPanel({
  clip,
  onChange,
  onApplyAll,
  onDone,
  group,
}: {
  clip: VideoClip | null;
  onChange: (adjustments: Adjustments) => void;
  onApplyAll: (adjustments: Adjustments) => void;
  onDone: () => void;
  group: Group;
}) {
  if (!clip) {
    return (
      <StudioSheet title="Adjust" onDone={onDone}>
        <EmptyHint>Select a clip first.</EmptyHint>
      </StudioSheet>
    );
  }
  const a = clip.adjustments;
  return (
    <StudioSheet title="Adjust" onDone={onDone} onReset={() => onChange(resetAdjustments())}>
      <div className="max-h-[168px] overflow-y-auto pr-1">
        {ADJUSTMENT_CONTROLS.map((control) => (
          <StudioSlider
            key={control.key}
            label={control.label}
            value={a[control.key]}
            min={control.min}
            max={control.max}
            onChange={(v) => onChange({ ...a, [control.key]: v })}
            onCommitStart={group.begin}
            onCommitEnd={group.end}
          />
        ))}
      </div>
      <div className="py-2">
        <Pill onClick={() => onApplyAll(a)}>Apply to all clips</Pill>
      </div>
    </StudioSheet>
  );
}
