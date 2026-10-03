import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { useLockedViewport } from "@/hooks/use-locked-viewport";

// A row that shows the chosen moment ("Sat 4 Oct · 9:00 PM", or the empty
// label) and opens a bottom sheet with a month calendar and an hour / minute
// / AM-PM wheel. Built on the dashboard's --sd-* tokens rather than the
// shadcn Calendar, whose primary-colour selection doesn't follow the
// dashboard's light/dark surface.
export function DateTimeField({
  label,
  emptyLabel,
  value,
  onChange,
  min,
}: {
  label: string;
  /** What the row says while nothing is picked, e.g. "Right away". */
  emptyLabel: string;
  value: Date | null;
  onChange: (next: Date | null) => void;
  /** Earliest pickable moment. Days before it are disabled. */
  min?: Date | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between py-3.5 text-left"
      >
        <span className="text-[15px] text-sd-ink">{label}</span>
        <span className="flex items-center gap-1 shrink-0">
          <span className={`text-sm ${value ? "text-sd-ink font-medium" : "text-sd-ink-faint"}`}>
            {value ? format(value, "EEE d MMM · h:mm a") : emptyLabel}
          </span>
          <ChevronRight size={16} className="text-sd-ink-faint" />
        </span>
      </button>
      {open && (
        <DateTimeSheet
          title={label}
          initial={value}
          min={min ?? null}
          onClear={() => {
            onChange(null);
            setOpen(false);
          }}
          onDone={(d) => {
            onChange(d);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1); // 1..12
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5); // 0..55
const PERIODS = ["AM", "PM"] as const;

// Next 5-minute mark an hour from now -- a sensible starting suggestion.
function defaultMoment(min: Date | null): Date {
  const base = min && min.getTime() > Date.now() ? new Date(min) : new Date();
  base.setHours(base.getHours() + 1);
  base.setMinutes(Math.ceil(base.getMinutes() / 5) * 5, 0, 0);
  return base;
}

function DateTimeSheet({
  title,
  initial,
  min,
  onClear,
  onDone,
  onClose,
}: {
  title: string;
  initial: Date | null;
  min: Date | null;
  onClear: () => void;
  onDone: (d: Date) => void;
  onClose: () => void;
}) {
  useLockedViewport();
  const start = initial ?? defaultMoment(min);
  const [day, setDay] = useState(startOfDay(start));
  const [month, setMonth] = useState(startOfMonth(start));
  const [hour12, setHour12] = useState(((start.getHours() + 11) % 12) + 1);
  const [minute, setMinute] = useState(Math.min(55, Math.round(start.getMinutes() / 5) * 5));
  const [period, setPeriod] = useState<"AM" | "PM">(start.getHours() >= 12 ? "PM" : "AM");

  const minDay = startOfDay(min && min.getTime() > Date.now() ? min : new Date());
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month)),
    end: endOfWeek(endOfMonth(month)),
  });

  const result = new Date(day);
  result.setHours((hour12 % 12) + (period === "PM" ? 12 : 0), minute, 0, 0);
  const floor = min && min.getTime() > Date.now() ? min : new Date();
  const tooEarly = result.getTime() <= floor.getTime();

  return (
    <div className="fixed inset-0 z-50 flex items-end min-h-dvh">
      <div
        className="absolute inset-0 bg-black/40 animate-in fade-in duration-200"
        onClick={onClose}
      />
      <div className="relative w-full bg-sd-surface rounded-t-2xl px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] animate-in fade-in slide-in-from-bottom-6 duration-[var(--duration-slow)] ease-[var(--ease-smooth-out)]">
        <div className="flex items-center justify-between mb-3">
          <button type="button" onClick={onClear} className="text-sm text-sd-ink-muted py-1">
            Clear
          </button>
          <span className="text-[15px] font-semibold text-sd-ink">{title}</span>
          <button
            type="button"
            disabled={tooEarly}
            onClick={() => onDone(result)}
            className="text-sm font-semibold text-sd-ink py-1 disabled:text-sd-ink-faint"
          >
            Done
          </button>
        </div>

        <div className="flex items-center justify-between px-1 mb-2">
          <span className="text-[15px] font-semibold text-sd-ink">
            {format(month, "MMMM yyyy")}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              aria-label="Previous month"
              disabled={!isBefore(startOfMonth(minDay), month)}
              onClick={() => setMonth((m) => addMonths(m, -1))}
              className="grid h-9 w-9 place-items-center rounded-full text-sd-ink disabled:text-sd-ink-faint active:bg-sd-soft"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setMonth((m) => addMonths(m, 1))}
              className="grid h-9 w-9 place-items-center rounded-full text-sd-ink active:bg-sd-soft"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 text-center text-[11px] font-medium text-sd-ink-faint mb-1">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {days.map((d) => {
            const disabled = isBefore(d, minDay);
            const selected = isSameDay(d, day);
            const inMonth = isSameMonth(d, month);
            return (
              <button
                key={d.toISOString()}
                type="button"
                disabled={disabled}
                onClick={() => {
                  setDay(d);
                  if (!inMonth) setMonth(startOfMonth(d));
                }}
                className={`mx-auto grid h-10 w-10 place-items-center rounded-full text-[15px] tabular-nums transition-colors duration-150 ${
                  selected
                    ? "bg-sd-ink text-sd-bg font-semibold"
                    : disabled
                      ? "text-sd-ink-faint/50"
                      : inMonth
                        ? "text-sd-ink active:bg-sd-soft"
                        : "text-sd-ink-faint"
                }`}
              >
                {format(d, "d")}
              </button>
            );
          })}
        </div>

        <div className="relative mt-4 flex justify-center gap-2">
          {/* The band behind the middle row marks what's selected. */}
          <div className="pointer-events-none absolute inset-x-0 top-1/2 h-10 -translate-y-1/2 rounded-xl bg-sd-soft" />
          <Wheel items={HOURS} value={hour12} onChange={setHour12} render={(h) => String(h)} />
          <Wheel
            items={MINUTES}
            value={minute}
            onChange={setMinute}
            render={(m) => String(m).padStart(2, "0")}
          />
          <Wheel items={[...PERIODS]} value={period} onChange={setPeriod} render={(p) => p} />
        </div>

        {tooEarly && (
          <p className="mt-3 text-center text-[13px] text-sd-danger-ink">
            {min && min.getTime() > Date.now()
              ? "Pick a time after the start."
              : "Pick a time in the future."}
          </p>
        )}
      </div>
    </div>
  );
}

const ITEM_H = 40;
const VISIBLE = 5;

// A scroll-snap column. The selected value is whichever item sits in the
// middle row once scrolling settles; tapping an item scrolls it there.
function Wheel<T extends string | number>({
  items,
  value,
  onChange,
  render,
}: {
  items: T[];
  value: T;
  onChange: (v: T) => void;
  render: (v: T) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = Math.max(0, items.indexOf(value)) * ITEM_H;
    // Only on mount -- after that the scroll position is the source of truth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      if (settle.current) clearTimeout(settle.current);
    },
    [],
  );

  return (
    <div
      ref={ref}
      onScroll={(e) => {
        const el = e.currentTarget;
        if (settle.current) clearTimeout(settle.current);
        settle.current = setTimeout(() => {
          const i = Math.min(items.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM_H)));
          if (items[i] !== value) onChange(items[i]);
        }, 80);
      }}
      className="relative w-16 overflow-y-auto overscroll-contain snap-y snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{
        height: ITEM_H * VISIBLE,
        paddingBlock: ITEM_H * ((VISIBLE - 1) / 2),
        maskImage: "linear-gradient(transparent, black 30%, black 70%, transparent)",
        WebkitMaskImage: "linear-gradient(transparent, black 30%, black 70%, transparent)",
      }}
    >
      {items.map((it, i) => (
        <button
          key={String(it)}
          type="button"
          onClick={() => ref.current?.scrollTo({ top: i * ITEM_H, behavior: "smooth" })}
          className={`block w-full snap-center text-center text-[20px] tabular-nums ${
            it === value ? "font-semibold text-sd-ink" : "text-sd-ink-muted"
          }`}
          style={{ height: ITEM_H }}
        >
          {render(it)}
        </button>
      ))}
    </div>
  );
}
