import CameraPanel from "./CameraPanel";

export type FlashMode = "off" | "auto" | "on";

type FlashPanelProps = {
  open: boolean;
  value: FlashMode;
  facing: "user" | "environment";
  onClose: () => void;
  onChange: (mode: FlashMode) => void;
};

export default function FlashPanel({
  open,
  value,
  facing,
  onClose,
  onChange,
}: FlashPanelProps) {
  const options = [
    {
      value: "off" as FlashMode,
      title: "Off",
      description:
        facing === "environment"
          ? "Disable the rear camera flash."
          : "Disable the screen flash.",
    },
    {
      value: "auto" as FlashMode,
      title: "Auto",
      description:
        facing === "environment"
          ? "Automatically use flash in low light when supported."
          : "Automatically brighten the screen in low light.",
    },
    {
      value: "on" as FlashMode,
      title: "On",
      description:
        facing === "environment"
          ? "Always fire the rear camera flash."
          : "Use a full-screen white flash like Snapchat.",
    },
  ];

  return (
    <CameraPanel
      open={open}
      onClose={onClose}
      title="Flash"
      height={360}
    >
      <div className="flex flex-col gap-3 pb-4">
        {options.map((option) => {
          const selected = option.value === value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                onClose();
              }}
              className="w-full transition-all duration-200"
              style={{
                textAlign: "left",
                borderRadius: 18,
                padding: "18px 20px",
                background: selected
                  ? "#ffffff"
                  : "rgba(255,255,255,0.06)",
                color: selected ? "#000000" : "#ffffff",
                border: selected
                  ? "1px solid transparent"
                  : "1px solid rgba(255,255,255,0.08)",
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
                    border: selected
                      ? "8px solid #000"
                      : "2px solid rgba(255,255,255,0.35)",
                    background: selected ? "#fff" : "transparent",
                    flexShrink: 0,
                  }}
                />
              </div>
            </button>
          );
        })}

        <div
          style={{
            marginTop: 10,
            padding: "14px 16px",
            borderRadius: 16,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            fontSize: 13,
            lineHeight: 1.5,
            opacity: 0.72,
          }}
        >
          {facing === "environment"
            ? "Rear camera uses the device flashlight (torch) when supported by your browser and device."
            : "Front camera uses a bright white screen flash to illuminate your face, similar to Snapchat and Instagram."}
        </div>
      </div>
    </CameraPanel>
  );
}