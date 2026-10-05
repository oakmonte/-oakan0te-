import { createFileRoute } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { BackButton } from "@/components/BackButton";

export const Route = createFileRoute("/studio")({
  component: StudioPlaceholder,
});

// Not built yet, so it says what the rest of the app says about locked
// features: a padlock and "unavailable", with a real way back out.
function StudioPlaceholder() {
  return (
    <div className="flex min-h-dvh flex-col bg-black text-white">
      <div
        className="flex items-center gap-2 px-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}
      >
        <BackButton
          icon="chevron"
          size={24}
          className="oak-tap -ml-2 grid h-11 w-11 place-items-center text-white"
        />
        <h1 className="text-[17px] font-semibold">Oakmonte Studio</h1>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 pb-24 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-white/10">
          <Lock size={28} strokeWidth={2.25} />
        </span>
        <p className="text-[18px] font-semibold">Oakmonte Studio is unavailable</p>
        <p className="max-w-[280px] text-[14px] leading-relaxed text-white/55">
          Creator tools are coming soon.
        </p>
      </div>
    </div>
  );
}
