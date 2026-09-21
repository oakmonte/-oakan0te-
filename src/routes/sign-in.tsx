import { createFileRoute } from "@tanstack/react-router";
import { AuthPanel } from "@/components/onboarding/AuthPanel";

export const Route = createFileRoute("/sign-in")({
  head: () => ({
    // White page, so the iOS status strip must be white too — the root
    // default is #000000 and would otherwise paint a black band above it.
    meta: [{ title: "Sign in — Oakmonte" }, { name: "theme-color", content: "#ffffff" }],
  }),
  component: SignInPage,
});

// For people who already have an account: password first, so a returning email
// user costs nothing to log in. Their flow is recorded on profiles.account_type,
// so this page sets no intent of its own.
function SignInPage() {
  return (
    <AuthPanel
      intent={null}
      title="Welcome back"
      subtitle="Sign in to pick up where you left off."
      defaultMode="password"
    />
  );
}
