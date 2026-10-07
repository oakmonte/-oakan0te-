import { Pill } from "../controls";
import { LAYER_ANIMS, type LayerAnim } from "@/lib/studio/layer-anim";

/** How a caption or sticker arrives. Plays in the preview while the video
 *  plays, and is baked into the export. */
export function AnimRow({
  value,
  withTypewriter,
  onChange,
}: {
  value: LayerAnim | undefined;
  /** Typewriter only means something for text. */
  withTypewriter: boolean;
  onChange: (anim: LayerAnim | undefined) => void;
}) {
  return (
    <div className="pt-1">
      <p className="pb-1 text-[11px] font-medium uppercase tracking-wide text-white/45">Entrance</p>
      <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
        {LAYER_ANIMS.filter((a) => withTypewriter || !a.textOnly).map((a) => (
          <Pill
            key={a.id}
            active={(value ?? "none") === a.id}
            onClick={() => onChange(a.id === "none" ? undefined : a.id)}
          >
            {a.label}
          </Pill>
        ))}
      </div>
    </div>
  );
}
