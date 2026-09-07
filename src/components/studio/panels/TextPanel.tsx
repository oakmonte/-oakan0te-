import { useEffect, useMemo, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import { blockedContentMessage, findBlockedContent } from "@/lib/content-policy";
import { EmptyHint, Pill, StudioSheet, StudioSlider } from "../controls";
import type { TextLayer } from "@/lib/after-shot-layers";
import type { TimedLayer } from "@/lib/studio/types";

// Timed captions. The difference from the after-shot text tool is the two
// numbers at the bottom: a studio caption exists between two instants rather
// than for the whole clip, which is what lets a size or a price appear exactly
// when the garment does.

const FONTS = [
  { id: "'SF Pro', system-ui, sans-serif", label: "Sans" },
  { id: "Georgia, 'Times New Roman', serif", label: "Serif" },
  { id: "'Courier New', monospace", label: "Mono" },
  { id: "Impact, 'Arial Black', sans-serif", label: "Bold" },
];

const COLORS = ["#FFFFFF", "#000000", "#F4C7B8", "#D8B24B", "#6366F1", "#FF4D6D", "#2AAE9A"];

export function TextPanel({
  layer,
  duration,
  currentTime,
  onAdd,
  onPatch,
  onDelete,
  onDone,
  group,
}: {
  layer: TimedLayer | null;
  duration: number;
  currentTime: number;
  onAdd: (content: string) => void;
  onPatch: (patch: Partial<TimedLayer>) => void;
  onDelete: () => void;
  onDone: () => void;
  group: { begin: () => void; end: () => void };
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);
  const inset = useKeyboardInset(focused);
  const isText = layer?.kind === "text";
  const text = isText ? (layer as TextLayer & TimedLayer) : null;

  // The draft in the "add" box, mirrored into state purely so the rule can see
  // it — the textarea itself stays uncontrolled, which is what lets Enter clear
  // it without a round trip.
  const [draft, setDraft] = useState("");
  const blocked = useMemo(() => findBlockedContent(text ? text.content : draft), [text, draft]);

  useEffect(() => {
    if (!layer) inputRef.current?.focus();
  }, [layer]);

  return (
    <div style={{ paddingBottom: inset }}>
      {/* A caption already on the timeline can still be edited into something
          that isn't allowed, so the gate is Done rather than the keystroke —
          fixing a typo must never be the thing that's blocked. Delete is right
          there in the same sheet if they'd rather drop it. */}
      <StudioSheet title="Text" onDone={onDone} doneDisabled={blocked.length > 0}>
        {!text ? (
          <div className="pb-2">
            <textarea
              ref={inputRef}
              rows={2}
              placeholder="Add a caption…"
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  const value = e.currentTarget.value.trim();
                  // Nothing gets placed on the timeline that couldn't stay
                  // there — the message below says why.
                  if (value && findBlockedContent(value).length === 0) {
                    onAdd(value);
                    e.currentTarget.value = "";
                    setDraft("");
                  }
                }
              }}
              className="w-full resize-none rounded-xl bg-white/10 px-3 py-2 text-[13px] outline-none placeholder:text-white/35"
            />
            {blocked.length > 0 ? (
              <p className="pt-1.5 text-[11px] leading-snug text-amber-300">
                {blockedContentMessage(blocked)}
              </p>
            ) : (
              <EmptyHint>Press enter to place it, then drag it on the preview.</EmptyHint>
            )}
          </div>
        ) : (
          <>
            <textarea
              value={text.content}
              rows={2}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onChange={(e) => onPatch({ content: e.target.value } as Partial<TimedLayer>)}
              className="mb-2 w-full resize-none rounded-xl bg-white/10 px-3 py-2 text-[13px] outline-none"
            />
            {blocked.length > 0 && (
              <p className="-mt-1 mb-2 text-[11px] leading-snug text-amber-300">
                {blockedContentMessage(blocked)}
              </p>
            )}

            <div className="flex gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden">
              {FONTS.map((font) => (
                <Pill
                  key={font.id}
                  active={text.font === font.id}
                  onClick={() => onPatch({ font: font.id } as Partial<TimedLayer>)}
                >
                  <span style={{ fontFamily: font.id }}>{font.label}</span>
                </Pill>
              ))}
              <Pill
                active={text.boxColor !== null}
                onClick={() =>
                  onPatch({
                    boxColor: text.boxColor ? null : "rgba(0,0,0,0.55)",
                  } as Partial<TimedLayer>)
                }
              >
                Box
              </Pill>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-3 [&::-webkit-scrollbar]:hidden">
              {COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => onPatch({ color } as Partial<TimedLayer>)}
                  aria-label={`Text colour ${color}`}
                  className="h-7 w-7 shrink-0 rounded-full"
                  style={{
                    background: color,
                    outline:
                      text.color === color ? "2px solid #fff" : "1px solid rgba(255,255,255,0.25)",
                    outlineOffset: 2,
                  }}
                />
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <StudioSlider
                label="Starts"
                value={Number(text.startTime.toFixed(2))}
                min={0}
                max={Math.max(0.1, duration)}
                step={0.05}
                suffix="s"
                onChange={(v) =>
                  onPatch({ startTime: Math.min(v, text.endTime - 0.1) } as Partial<TimedLayer>)
                }
                onCommitStart={group.begin}
                onCommitEnd={group.end}
              />
              <StudioSlider
                label="Ends"
                value={Number(text.endTime.toFixed(2))}
                min={0}
                max={Math.max(0.1, duration)}
                step={0.05}
                suffix="s"
                onChange={(v) =>
                  onPatch({ endTime: Math.max(v, text.startTime + 0.1) } as Partial<TimedLayer>)
                }
                onCommitStart={group.begin}
                onCommitEnd={group.end}
              />
            </div>

            <div className="flex gap-2 overflow-x-auto py-2 [&::-webkit-scrollbar]:hidden">
              <Pill
                onClick={() =>
                  onPatch({
                    startTime: Math.min(currentTime, text.endTime - 0.1),
                  } as Partial<TimedLayer>)
                }
              >
                Start here
              </Pill>
              <Pill
                onClick={() =>
                  onPatch({
                    endTime: Math.max(currentTime, text.startTime + 0.1),
                  } as Partial<TimedLayer>)
                }
              >
                End here
              </Pill>
              <Pill tone="danger" onClick={onDelete}>
                <span className="flex items-center gap-1">
                  <Trash2 size={13} /> Delete
                </span>
              </Pill>
            </div>
          </>
        )}
      </StudioSheet>
    </div>
  );
}
