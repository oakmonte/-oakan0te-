import { useState } from "react";
import { Tag, Trash2 } from "lucide-react";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import { EmptyHint, Pill, StudioSheet, StudioSlider } from "../controls";
import type { ProductPin } from "@/lib/studio/types";

// Shoppable tags — the one thing in this editor that only makes sense inside a
// marketplace. A pin is a garment, a price and a stretch of time, anchored to a
// point in the frame; it bakes into the video so the tag survives every re-share
// off-platform, which is the whole reason to put it in the pixels rather than in
// an interactive layer on top.
//
// Titles and prices are typed for now. Once real store scoping replaces
// DEV_STORE_ID this should read the seller's own catalogue and carry the product
// id through, so a tap on the finished post can deep-link to the listing.

export function PinPanel({
  pin,
  duration,
  currentTime,
  onAdd,
  onPatch,
  onDelete,
  onDone,
  group,
}: {
  pin: ProductPin | null;
  duration: number;
  currentTime: number;
  onAdd: (title: string, price: string) => void;
  onPatch: (patch: Partial<ProductPin>) => void;
  onDelete: () => void;
  onDone: () => void;
  group: { begin: () => void; end: () => void };
}) {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [focused, setFocused] = useState(false);
  const inset = useKeyboardInset(focused);

  return (
    <div style={{ paddingBottom: inset }}>
      <StudioSheet title="Product tag" onDone={onDone}>
        {!pin ? (
          <div className="pb-2">
            <div className="flex gap-2">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="Item name"
                className="min-w-0 flex-1 rounded-xl bg-white/10 px-3 py-2 text-[13px] outline-none placeholder:text-white/35"
              />
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="₦0"
                inputMode="decimal"
                className="w-24 rounded-xl bg-white/10 px-3 py-2 text-[13px] outline-none placeholder:text-white/35"
              />
            </div>
            <div className="pt-2">
              <Pill
                onClick={() => {
                  const name = title.trim();
                  if (!name) return;
                  onAdd(name, price.trim());
                  setTitle("");
                  setPrice("");
                }}
                disabled={!title.trim()}
              >
                <span className="flex items-center gap-1.5">
                  <Tag size={13} /> Tag at playhead
                </span>
              </Pill>
            </div>
            <EmptyHint>Drop a tag, then drag it onto the piece in the preview.</EmptyHint>
          </div>
        ) : (
          <>
            <div className="flex gap-2 pb-2">
              <input
                value={pin.title}
                onChange={(e) => onPatch({ title: e.target.value })}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                className="min-w-0 flex-1 rounded-xl bg-white/10 px-3 py-2 text-[13px] outline-none"
              />
              <input
                value={pin.price}
                onChange={(e) => onPatch({ price: e.target.value })}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                inputMode="decimal"
                className="w-24 rounded-xl bg-white/10 px-3 py-2 text-[13px] outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <StudioSlider
                label="Appears"
                value={Number(pin.startTime.toFixed(2))}
                min={0}
                max={Math.max(0.1, duration)}
                step={0.05}
                suffix="s"
                onChange={(v) => onPatch({ startTime: Math.min(v, pin.endTime - 0.1) })}
                onCommitStart={group.begin}
                onCommitEnd={group.end}
              />
              <StudioSlider
                label="Hides"
                value={Number(pin.endTime.toFixed(2))}
                min={0}
                max={Math.max(0.1, duration)}
                step={0.05}
                suffix="s"
                onChange={(v) => onPatch({ endTime: Math.max(v, pin.startTime + 0.1) })}
                onCommitStart={group.begin}
                onCommitEnd={group.end}
              />
            </div>

            <div className="flex gap-2 overflow-x-auto py-2 [&::-webkit-scrollbar]:hidden">
              <Pill
                active={pin.side === "right"}
                onClick={() => onPatch({ side: pin.side === "right" ? "left" : "right" })}
              >
                Flip side
              </Pill>
              <Pill
                onClick={() => onPatch({ startTime: Math.min(currentTime, pin.endTime - 0.1) })}
              >
                Start here
              </Pill>
              <Pill
                onClick={() => onPatch({ endTime: Math.max(currentTime, pin.startTime + 0.1) })}
              >
                End here
              </Pill>
              <Pill tone="danger" onClick={onDelete}>
                <span className="flex items-center gap-1">
                  <Trash2 size={13} /> Remove
                </span>
              </Pill>
            </div>
          </>
        )}
      </StudioSheet>
    </div>
  );
}
