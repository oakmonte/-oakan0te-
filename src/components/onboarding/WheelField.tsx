import { useMemo } from "react";
import { WheelPicker, WheelPickerWrapper, type WheelPickerOption } from "@ncdai/react-wheel-picker";
import "@ncdai/react-wheel-picker/style.css";
import { hapticTick } from "@/lib/haptics";

/** One width rule for every wheel, so the unit toggles above it can share it and
 *  sit flush with the wheel's right edge. Scales with the phone: the 190px
 *  floor keeps "250 cm" legible on a 320px screen, the 220px cap stops it
 *  ballooning on a big one. */
export const WHEEL_WIDTH_CLASS = "mx-auto w-[clamp(190px,62%,220px)]";

export type WheelColumn = {
  min: number;
  max: number;
  /** Appended to each number ("170 cm"). Leave off when `labels` or the bare
   *  number is what should show. */
  unit?: string;
  /** Replaces the number as the row text; index 0 is `min`. */
  labels?: readonly string[];
  value: number;
  onChange: (value: number) => void;
};

function optionsFor(column: WheelColumn): WheelPickerOption<number>[] {
  const out: WheelPickerOption<number>[] = [];
  for (let n = column.min; n <= column.max; n++) {
    const label =
      column.labels?.[n - column.min] ?? (column.unit ? `${n} ${column.unit}` : String(n));
    out.push({ value: n, label });
  }
  return out;
}

/** iOS-style drum picker for one measurement. A wheel can't be "empty", so it
 *  shows a default but stays dimmed until the person touches it -- `onEngage`
 *  is where the caller commits those defaults, so a skipped field is never
 *  saved as a value nobody picked. */
export function WheelField({
  columns,
  engaged,
  onEngage,
}: {
  columns: WheelColumn[];
  engaged: boolean;
  onEngage: () => void;
}) {
  const shape = columns
    .map((c) => `${c.min}~${c.max}~${c.unit ?? ""}~${c.labels?.join(",") ?? ""}`)
    .join("|");
  const options = useMemo(
    () => columns.map(optionsFor),
    // Ranges, units and labels are all captured by `shape`; values change
    // constantly and must not rebuild the option lists.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shape],
  );

  return (
    <div
      onPointerDown={() => {
        if (!engaged) onEngage();
      }}
      className={`${WHEEL_WIDTH_CLASS} transition-opacity duration-300 ${engaged ? "opacity-100" : "opacity-50"}`}
    >
      <WheelPickerWrapper className="h-[168px] rounded-2xl border border-brand-text/15">
        {columns.map((c, i) => (
          <WheelPicker<number>
            key={`${c.unit ?? "col"}-${c.min}-${i}`}
            options={options[i]}
            value={c.value}
            optionItemHeight={40}
            onValueChange={(v) => {
              hapticTick();
              c.onChange(v);
            }}
            classNames={{
              optionItem: "text-[17px] text-brand-text/40",
              highlightWrapper: "rounded-xl bg-[#EFEFEF]",
              highlightItem: "text-[20px] font-medium text-brand-text",
            }}
          />
        ))}
      </WheelPickerWrapper>
    </div>
  );
}
