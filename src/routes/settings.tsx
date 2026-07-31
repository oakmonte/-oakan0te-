import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/settings")({
  component: SettingsPlaceholder,
});

function SettingsPlaceholder() {
  return (
    <div className="min-h-screen bg-black p-8 text-white">
      <h1 className="text-2xl font-semibold">Settings & Privacy</h1>
      <p className="mt-3 text-white/70">This route is still being built. It will contain account and privacy controls.</p>
    </div>
  );
}
