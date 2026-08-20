import CameraPanel from "./CameraPanel";

export type CameraRatio = "9:16" | "3:4" | "1:1" | "4:3" | "16:9";

type RatioPanelProps = {
  open: boolean;
  value: CameraRatio;
  onClose: () => void;
  onChange: (ratio: CameraRatio) => void;
};

const RATIOS: {
  value: CameraRatio;
  name: string;
  description: string;
}[] = [
  {
    value: "9:16",
    name: "Story",
    description: "Perfect for stories, reels and full-screen content.",
  },
  {
    value: "3:4",
    name: "Portrait",
    description: "Traditional camera framing with a little extra width.",
  },
  {
    value: "1:1",
    name: "Square",
    description: "Ideal for feed posts and product photography.",
  },
  {
    value: "4:3",
    name: "Landscape",
    description: "Natural horizontal framing for products and scenes.",
  },
  {
    value: "16:9",
    name: "Cinema",
    description: "Wide cinematic framing for videos.",
  },
];

export default function RatioPanel({ open, value, onClose, onChange }: RatioPanelProps) {
  return (
    <CameraPanel open={open} onClose={onClose} title="Aspect Ratio" height={430}>
      <div className="flex flex-col gap-3 pb-4">
        {RATIOS.map((ratio) => {
          const selected = ratio.value === value;

          return (
            <button
              key={ratio.value}
              type="button"
              onClick={() => {
                onChange(ratio.value);
                onClose();
              }}
              className="oak-motion-surface w-full transition-all duration-200"
              style={{
                textAlign: "left",
                borderRadius: 18,
                padding: "18px 20px",
                background: selected ? "#ffffff" : "rgba(255,255,255,0.06)",
                color: selected ? "#000000" : "#ffffff",
                border: selected ? "1px solid transparent" : "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="pr-5">
                  <div
                    style={{
                      fontSize: 17,
                      fontWeight: 600,
                      lineHeight: 1.2,
                    }}
                  >
                    {ratio.name}
                  </div>

                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 13,
                      opacity: selected ? 0.7 : 0.6,
                      lineHeight: 1.35,
                    }}
                  >
                    {ratio.description}
                  </div>
                </div>

                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    letterSpacing: "-0.03em",
                  }}
                >
                  {ratio.value}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </CameraPanel>
  );
}
