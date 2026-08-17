import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/store/growth")({
  component: () => <div className="px-4 py-8 text-sm text-gray-400">Growth — coming soon.</div>,
});
