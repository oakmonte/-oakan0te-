import { RotateCcw } from "lucide-react";
import {
  ADJUST_CONTROLS,
  NEUTRAL_ADJUST,
  isNeutralAdjust,
  type PhotoAdjust,
} from "@/lib/photo-adjust";

/** The Adjust tool's sliders. A bottom sheet rather than an overlay because
 *  there's nothing on the frame to place or drag — you change a number and
 *  watch the photo behind it, so the sheet stays as short as it can and the
 *  media keeps as much of the screen as possible.
 *
 *  Every slider is bipolar and centre-detented at 0, which is what makes
 *  "back to untouched" a thing you can find with your thumb rather than only
 *  through Reset. */
export default function PhotoAdjustPanel({
  open,
  value,
  onChange,
  onClose,
}: {
  open: boolean;
  value: PhotoAdjust;
  onChange: (next: PhotoAdjust) => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="absolute inset-x-0 bottom-0 z-40">
      <div className="absolute inset-0 -top-[100vh]" onClick={onClose} />
      <div
        className="oak-motion-enter relative rounded-t-[14px] px-5 pt-3"
        style={{
          background: "rgba(28,28,30,0.94)",
          backdropFilter: "blur(20px)",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)",
        }}
      >
        <div className="flex items-center justify-between pb-1">
          <span className="text-[14px] font-semibold text-white">Adjust</span>
          <button
            type="button"
            onClick={() => onChange(NEUTRAL_ADJUST)}
            disabled={isNeutralAdjust(value)}
            className="flex items-center gap-1.5 text-[12px] font-medium text-white/70 active:scale-95 disabled:opacity-30"
          >
            <RotateCcw size={13} /> Reset
          </button>
        </div>

        {ADJUST_CONTROLS.map(({ key, label }) => (
          <div key={key} className="py-1.5">
            <div className="flex items-center justify-between pb-1">
              <span className="text-[12px] text-white/60">{label}</span>
              <span className="text-[12px] font-medium tabular-nums text-white">
                {value[key] > 0 ? `+${value[key]}` : value[key]}
              </span>
            </div>
            <input
              type="range"
              min={-100}
              max={100}
              step={1}
              value={value[key]}
              onChange={(e) => onChange({ ...value, [key]: Number(e.target.value) })}
              aria-label={label}
              className="oak-adjust-range w-full"
            />
          </div>
        ))}

        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded-full bg-white py-2.5 text-[13px] font-semibold text-black active:scale-[0.98]"
        >
          Done
        </button>
      </div>

      <style>{`
        .oak-adjust-range {
          -webkit-appearance: none;
          appearance: none;
          height: 2px;
          border-radius: 2px;
          background: rgba(255,255,255,0.22);
          outline: none;
        }
        .oak-adjust-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px; height: 16px;
          border-radius: 50%;
          background: #fff;
          box-shadow: 0 1px 4px rgba(0,0,0,0.4);
        }
        .oak-adjust-range::-moz-range-thumb {
          width: 16px; height: 16px;
          border: none;
          border-radius: 50%;
          background: #fff;
        }
      `}</style>
    </div>
  );
}
