import { createFileRoute } from "@tanstack/react-router";
import { AuthPanel } from "@/components/onboarding/AuthPanel";

export const Route = createFileRoute("/become-a-curator")({
  head: () => ({
    meta: [
      { title: "Become a Curator — Oakmonte" },
      { name: "description", content: "Join Oakmonte as a curator and define your wardrobe." },
      { property: "og:title", content: "Become a Curator — Oakmonte" },
      {
        property: "og:description",
        content: "Join Oakmonte as a curator and define your wardrobe.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BecomeCuratorPage,
});

function BecomeCuratorPage() {
  return (
    <AuthPanel
      intent="curator"
      title="Become a Curator"
      subtitle="Define your wardrobe and discover pieces that fit you."
    />
  );
}
