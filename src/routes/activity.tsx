import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/activity")({
  component: ActivityPlaceholder,
});

function ActivityPlaceholder() {
  return (
    <div className="min-h-screen bg-black p-8 text-white">
      <h1 className="text-2xl font-semibold">Activity Centre</h1>
      <p className="mt-3 text-white/70">
        This route is still being built. It will show your recent activity and updates.
      </p>
    </div>
  );
}
