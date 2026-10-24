import { StoreThemeSelector } from "@/components/store-theme-selector";
import { useHideStoreNav } from "@/components/store/store-nav";
import { createFileRoute } from "@tanstack/react-router";
import { DesktopPanel } from "@/components/store/DesktopPanel";

export const Route = createFileRoute("/store/theme")({
  validateSearch: (search: Record<string, unknown>): { checklist?: boolean } => ({
    checklist: search.checklist === true || search.checklist === "true" ? true : undefined,
  }),
  component: StoreTheme,
});

function StoreTheme() {
  const { checklist } = Route.useSearch();
  // Arrived from the setup checklist: a focused step, no nav bar.
  useHideStoreNav(!!checklist);
  return (
    <DesktopPanel>
      <StoreThemeSelector />
    </DesktopPanel>
  );
}
