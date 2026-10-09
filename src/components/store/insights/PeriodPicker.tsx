import { PERIODS, type Period } from "@/lib/insights";

/** 7D / 30D / 90D. A radio group because exactly one is always chosen.
 *
 *  Each button is a 40px-tall hit area around a smaller drawn pill, so the
 *  control stays tappable without looking like a row of fat buttons beside a
 *  17px heading. */
export function PeriodPicker({
  value,
  onChange,
  label = "Period",
}: {
  value: Period;
  onChange: (p: Period) => void;
  label?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex shrink-0 items-center">
      <div className="flex rounded-full bg-sd-soft px-0.5">
        {PERIODS.map((p) => {
          const on = p.value === value;
          return (
            <button
              key={p.value}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={p.label}
              onClick={() => onChange(p.value)}
              className="oak-tap grid h-10 min-w-[44px] place-items-center"
            >
              <span
                className={`grid h-8 place-items-center rounded-full px-2.5 text-[13px] font-semibold transition-colors duration-150 ${
                  on ? "bg-sd-surface text-sd-ink shadow-sm" : "text-sd-ink-muted"
                }`}
              >
                {p.short}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
