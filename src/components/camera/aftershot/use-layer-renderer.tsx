import { useCallback } from "react";
import {
  TEXT_LAYER_WIDTH_FRACTION,
  TEXT_LAYER_LINE_HEIGHT,
  TEXT_LAYER_BOX_PAD_X,
  TEXT_LAYER_BOX_PAD_Y,
  TEXT_LAYER_BOX_RADIUS,
  TEXT_LAYER_SHADOW_BLUR,
  TEXT_LAYER_SHADOW_OFFSET_Y,
  TEXT_LAYER_SHADOW_COLOR,
  type Layer,
} from "@/lib/after-shot-layers";

// How a confirmed layer looks on screen. Shared by the after-shot edit screen
// and the trim screen so a caption can't render one way on one and another way
// on the other — and every number it uses is the same constant layer-bake.ts
// draws with, so the preview and the exported file agree too.
export function useLayerRenderer(mediaBoxRef: React.RefObject<HTMLDivElement | null>) {
  return useCallback(
    (layer: Layer) => {
      if (layer.kind === "text") {
        const boxWidth = mediaBoxRef.current?.clientWidth ?? 0;
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
          // the text instead of painting a full-width bar behind it.
          <span
            style={{
              display: "block",
              width: boxWidth * TEXT_LAYER_WIDTH_FRACTION,
              textAlign: layer.align,
              pointerEvents: "none",
            }}
          >
            <span
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
        const boxWidth = mediaBoxRef.current?.clientWidth ?? 0;
        return (
          <svg
            width={boxWidth}
            height={boxWidth}
            viewBox={`${-boxWidth / 2} ${-boxWidth / 2} ${boxWidth} ${boxWidth}`}
            style={{ overflow: "visible", pointerEvents: "none" }}
          >
            {layer.strokes.map((stroke, i) => (
              <polyline
                key={i}
                points={stroke.points.map(([x, y]) => `${x * boxWidth},${y * boxWidth}`).join(" ")}
                fill="none"
                stroke={stroke.color}
                strokeWidth={stroke.width * boxWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={
                  stroke.glow
                    ? {
                        filter: `drop-shadow(0 0 ${stroke.width * boxWidth * 0.9}px ${stroke.color})`,
                      }
                    : undefined
                }
              />
            ))}
          </svg>
        );
      }
      return null;
    },
    [mediaBoxRef],
  );
}
