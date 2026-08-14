import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/store/finance")({
  component: () => <div className="px-4 py-8 text-sm text-gray-400">Finance — coming soon.</div>,
});