import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/store/discounts")({
  component: () => <div className="px-4 py-8 text-sm text-gray-400">Discounts — coming soon.</div>,
});
