import { useMemo } from "react";
import { WheelPicker, WheelPickerWrapper, type WheelPickerOption } from "@ncdai/react-wheel-picker";
import "@ncdai/react-wheel-picker/style.css";
import { hapticTick } from "@/lib/haptics";

export type WheelColumn = {
  min: number;
  max: number;
  unit: string;
  value: number;
  onChange: (value: number) => void;
};

function optionsFor(min: number, max: number, unit: string): WheelPickerOption<number>[] {
  const out: WheelPickerOption<number>[] = [];
  for (let n = min; n <= max; n++) out.push({ value: n, label: `${n} ${unit}` });
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
  const shape = columns.map((c) => `${c.min}-${c.max}-${c.unit}`).join("|");
  const options = useMemo(
    () =>
      shape.split("|").map((part) => {
        const [min, max, unit] = part.split("-");
        return optionsFor(Number(min), Number(max), unit);
      }),
    [shape],
  );

  return (
    <div
      onPointerDown={() => {
        if (!engaged) onEngage();
      }}
      className={`transition-opacity duration-300 ${engaged ? "opacity-100" : "opacity-50"}`}
    >
      <WheelPickerWrapper className="h-[168px] rounded-2xl border border-brand-text/15">
        {columns.map((c, i) => (
          <WheelPicker<number>
            key={`${c.unit}-${c.min}`}
            options={options[i]}
            value={c.value}
            optionItemHeight={40}
            onValueChange={(v) => {
              hapticTick();
              c.onChange(v);
            }}
            classNames={{
              optionItem: "text-[17px] text-brand-text/40",
              highlightWrapper: "rounded-xl bg-brand-text/[0.07]",
              highlightItem: "text-[20px] font-medium text-brand-text",
            }}
          />
        ))}
      </WheelPickerWrapper>
    </div>
  );
}
