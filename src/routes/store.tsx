import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/store")({
  component: StorePlaceholder,
});

function StorePlaceholder() {
  return (
    <div className="min-h-screen bg-black p-8 text-white">
      <h1 className="text-2xl font-semibold">Oakmonte Store</h1>
      <p className="mt-3 text-white/70">
        This route is still being built. It will become the storefront experience.
      </p>
    </div>
  );
}
