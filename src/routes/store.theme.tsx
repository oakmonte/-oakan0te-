import { StoreThemeSelector } from "@/components/store-theme-selector";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/store/theme")({
  validateSearch: (search: Record<string, unknown>): { checklist?: boolean } => ({
    checklist: search.checklist === true || search.checklist === "true" ? true : undefined,
  }),
  component: StoreTheme,
});

function StoreTheme() {
  return <StoreThemeSelector />;
}
