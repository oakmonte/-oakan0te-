import { createContext, useContext } from "react";
import type { CapturedMedia } from "@/lib/capture-handoff";
import type { CropRect } from "@/lib/crop-rect";
import { NEUTRAL_ADJUST, type PhotoAdjust } from "@/lib/photo-adjust";

/** The after-shot screen's own edits, as intent rather than pixels.
 *
 *  Held on the layout next to the layer stack, for the same reason: the index
 *  page unmounts whenever you visit the studio or publish, and state it owned
 *  died with it. Coming back from publish used to show the BAKED file with the
 *  captions still floating on top — the same caption twice, one of them
 *  immovable — and a second Next baked it again. Keeping the edits here and
 *  the untouched capture in `media` means every export composites once, from
 *  the original, however many times you go back and forth. */
export type AfterShotEdits = {
  filterId: string;
  filterIntensity: number;
  adjust: PhotoAdjust;
  cropRect: CropRect | null;
};

export const NO_EDITS: AfterShotEdits = {
  filterId: "natural",
  filterIntensity: 100,
  adjust: NEUTRAL_ADJUST,
  cropRect: null,
};

export type AfterShotContextValue = {
  /** What the editors edit: the capture, or the studio's render of it. Never
   *  the after-shot composite — that is `output`. */
  media: CapturedMedia;
  /** Replace the source. A different file resets the crop (it was a fraction
   *  of the old frame) and throws away any stale `output`. */
  setMedia: (media: CapturedMedia) => void;
  discard: () => void;
  edits: AfterShotEdits;
  setEdits: (update: (prev: AfterShotEdits) => AfterShotEdits) => void;
  /** The finished composite publish uploads, or null when Next found nothing
   *  to bake and `media` goes out as it is. */
  output: CapturedMedia | null;
  setOutput: (output: CapturedMedia | null) => void;
};

export const AfterShotContext = createContext<AfterShotContextValue | null>(null);

export function useAfterShotContext() {
  const ctx = useContext(AfterShotContext);
  if (!ctx) throw new Error("useAfterShotContext must be used within /create/after-shot");
  return ctx;
}
