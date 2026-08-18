import { StoreThemeSelector } from "@/components/store-theme-selector";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/store/theme")({
  component: StoreTheme,
});

function StoreTheme() {
  return <StoreThemeSelector />;
}
