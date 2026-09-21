import { createFileRoute } from "@tanstack/react-router";
import { AuthPanel } from "@/components/onboarding/AuthPanel";

export const Route = createFileRoute("/set-up-store")({
  head: () => ({
    meta: [
      // White page, so the iOS status strip must be white too — the root
      // default is #000000 and would otherwise paint a black band above it.
      { name: "theme-color", content: "#ffffff" },
      { title: "Set up a Store — Oakmonte" },
      {
        name: "description",
        content: "Create your Oakmonte seller account to launch a content-driven storefront.",
      },
      { property: "og:title", content: "Set up a Store — Oakmonte" },
      {
        property: "og:description",
        content: "Create your Oakmonte seller account to launch a content-driven storefront.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SetUpStorePage,
});

function SetUpStorePage() {
  return (
    <AuthPanel
      intent="seller"
      title="Set up a Store"
      subtitle="Join Oakmonte as a vetted seller."
    />
  );
}
