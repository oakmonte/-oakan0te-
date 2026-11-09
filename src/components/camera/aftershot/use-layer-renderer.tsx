import { useCallback, useEffect, useState } from "react";
import {
  TEXT_LAYER_WIDTH_FRACTION,
  TEXT_LAYER_LINE_HEIGHT,
  TEXT_LAYER_BOX_PAD_X,
  TEXT_LAYER_BOX_PAD_Y,
  TEXT_LAYER_BOX_RADIUS,
  TEXT_LAYER_SHADOW_BLUR,
  TEXT_LAYER_SHADOW_OFFSET_Y,
  TEXT_LAYER_SHADOW_COLOR,
  STICKER_LAYER_WIDTH_FRACTION,
  type Layer,
} from "@/lib/after-shot-layers";
import { StrokeShape } from "./StrokeShape";

// How a confirmed layer looks on screen. Shared by the after-shot edit screen
// and the studio so a caption can't render one way on one and another way
// on the other — and every number it uses is the same constant layer-bake.ts
// draws with, so the preview and the exported file agree too.
export function useLayerRenderer(mediaBoxRef: React.RefObject<HTMLDivElement | null>) {
  // Tracked, not just read at render time. Sizes are fractions of the media
  // box, and in the studio that box shrinks whenever a sheet (Speed, Volume…)
  // opens. Read from the ref alone, a caption kept whatever size it had at the
  // last unrelated re-render — overflowing the shrunken frame, then staying
  // small after the sheet closed, while the export drew it at the real size.
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = mediaBoxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => setWidth((prev) => (prev === el.clientWidth ? prev : el.clientWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mediaBoxRef]);

  return useCallback(
    (layer: Layer) => {
      if (layer.kind === "text") {
        const boxWidth = width || (mediaBoxRef.current?.clientWidth ?? 0);
        const fontPx = layer.fontSize * boxWidth;
        return (
          // Two spans on purpose. The outer one carries a DEFINITE width — the
          // same width the composing textarea had — so the text breaks at the
          // exact same points and doesn't reflow the instant it's placed. It has
          // to be definite rather than a max-width because LayerOverlay's wrapper
          // is absolutely positioned with only `left`, so it shrink-to-fits
          // against the space left of the media box edge (about half of it at
          // x=0.5) and would squeeze a max-width span far narrower than intended.
          // The inner one stays inline-block so the optional text box still hugs
          // the text instead of painting a full-width bar behind it — and it is
          // the part LayerOverlay outlines (`data-layer-bounds`), so the
          // selection frame hugs the words rather than the 80% wrap box.
          <span
            style={{
              display: "block",
              width: boxWidth * TEXT_LAYER_WIDTH_FRACTION,
              textAlign: layer.align,
              pointerEvents: "none",
            }}
          >
            <span
              data-layer-bounds=""
              style={{
                display: "inline-block",
                maxWidth: "100%",
                fontFamily: layer.font,
                color: layer.color,
                fontSize: fontPx,
                fontWeight: layer.fontWeight,
                textAlign: layer.align,
                lineHeight: TEXT_LAYER_LINE_HEIGHT,
                whiteSpace: "pre-wrap",
                overflowWrap: "break-word",
                // Padding/radius/shadow are all multiples of font size, matching
                // layer-bake.ts exactly — fixed px here would come out roughly a
                // third of the intended size once baked at full resolution.
                textShadow: layer.boxColor
                  ? "none"
                  : `0 ${fontPx * TEXT_LAYER_SHADOW_OFFSET_Y}px ${fontPx * TEXT_LAYER_SHADOW_BLUR}px ${TEXT_LAYER_SHADOW_COLOR}`,
                background: layer.boxColor ?? "transparent",
                padding: layer.boxColor
                  ? `${fontPx * TEXT_LAYER_BOX_PAD_Y}px ${fontPx * TEXT_LAYER_BOX_PAD_X}px`
                  : 0,
                borderRadius: layer.boxColor ? fontPx * TEXT_LAYER_BOX_RADIUS : 0,
              }}
            >
              {layer.content}
            </span>
          </span>
        );
      }
      if (layer.kind === "draw") {
        // Raw px user units, sized off the media box — the same space DrawPanel
        // captured in and the same space layer-bake scales by canvas width. The
        // old version drew into a fixed 200px box with a 0-1 viewBox AND
        // vector-effect="non-scaling-stroke", which made stroke-width 0.014 mean
        // 0.014 screen px: placed drawings painted nothing at all.
        const boxWidth = width || (mediaBoxRef.current?.clientWidth ?? 0);
        // Half the thickest stroke: getBBox measures centre lines, and
        // LayerOverlay grows the frame by this so a fat stroke stays inside.
        const strokePad = Math.max(0, ...layer.strokes.map((st) => st.width)) * boxWidth * 0.5;
        return (
          <svg
            data-layer-bounds=""
            data-stroke-pad={strokePad}
            width={boxWidth}
            height={boxWidth}
            viewBox={`${-boxWidth / 2} ${-boxWidth / 2} ${boxWidth} ${boxWidth}`}
            style={{ overflow: "visible", pointerEvents: "none" }}
          >
            {layer.strokes.map((stroke, i) => (
              <StrokeShape key={i} stroke={stroke} scale={boxWidth} />
            ))}
          </svg>
        );
      }
      if (layer.kind === "sticker") {
        // Width only — height follows the image's own aspect, which is exactly
        // what drawStickerLayer does at bake time (baseW, then baseH derived
        // from naturalHeight/naturalWidth).
        const boxWidth = width || (mediaBoxRef.current?.clientWidth ?? 0);
        return (
          <img
            src={layer.assetUrl}
            alt=""
            draggable={false}
            style={{
              display: "block",
              width: boxWidth * STICKER_LAYER_WIDTH_FRACTION,
              height: "auto",
              pointerEvents: "none",
              userSelect: "none",
            }}
          />
        );
      }
      return null;
    },
    [mediaBoxRef, width],
  );
}
