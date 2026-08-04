import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/studio")({
  component: StudioPlaceholder,
});

function StudioPlaceholder() {
  return (
    <div className="min-h-screen bg-black p-8 text-white">
      <h1 className="text-2xl font-semibold">Oakmonte Studio</h1>
      <p className="mt-3 text-white/70">
        This route is still being built. It will house creator tools and studio workflows.
      </p>
    </div>
  );
}
