import CameraPanel from "./CameraPanel";

export type CameraTimer = 0 | 3 | 5 | 10;

type TimerPanelProps = {
  open: boolean;
  value: CameraTimer;
  onClose: () => void;
  onChange: (value: CameraTimer) => void;
};

const OPTIONS: {
  value: CameraTimer;
  title: string;
  description: string;
}[] = [
  {
    value: 0,
    title: "Off",
    description: "Capture immediately.",
  },
  {
    value: 3,
    title: "3 Seconds",
    description: "Quick hands-free capture.",
  },
  {
    value: 5,
    title: "5 Seconds",
    description: "Extra time to get into position.",
  },
  {
    value: 10,
    title: "10 Seconds",
    description: "Ideal for full-body photos and group shots.",
  },
];

export default function TimerPanel({ open, value, onClose, onChange }: TimerPanelProps) {
  return (
    <CameraPanel open={open} onClose={onClose} title="Capture Timer" height={390}>
      <div className="flex flex-col gap-3 pb-4">
        {OPTIONS.map((option) => {
          const selected = option.value === value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
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
                    {option.title}
                  </div>

                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 13,
                      opacity: selected ? 0.7 : 0.6,
                      lineHeight: 1.35,
                    }}
                  >
                    {option.description}
                  </div>
                </div>

                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "9999px",
                    border: selected ? "8px solid #000" : "2px solid rgba(255,255,255,0.35)",
                    background: selected ? "#fff" : "transparent",
                    flexShrink: 0,
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </CameraPanel>
  );
}
