import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/offline-videos")({
  component: OfflineVideosPlaceholder,
});

function OfflineVideosPlaceholder() {
  return (
    <div className="min-h-screen bg-black p-8 text-white">
      <h1 className="text-2xl font-semibold">Offline Videos</h1>
      <p className="mt-3 text-white/70">
        This route is still being built. It will hold saved or downloadable video content.
      </p>
    </div>
  );
}
