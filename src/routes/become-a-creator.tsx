import { createFileRoute } from "@tanstack/react-router";
import { AuthPanel } from "@/components/onboarding/AuthPanel";

export const Route = createFileRoute("/become-a-creator")({
  head: () => ({
    meta: [
      { title: "Become a Creator — Oakmonte" },
      {
        name: "description",
        content: "Join Oakmonte as a creator and turn your style into commerce.",
      },
      { property: "og:title", content: "Become a Creator — Oakmonte" },
      {
        property: "og:description",
        content: "Join Oakmonte as a creator and turn your style into commerce.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BecomeCreatorPage,
});

function BecomeCreatorPage() {
  return (
    <AuthPanel
      intent="creator"
      title="Become a Creator"
      subtitle="Join Oakmonte and make money from creative content."
    />
  );
}
