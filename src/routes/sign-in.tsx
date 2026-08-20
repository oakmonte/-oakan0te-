import { createFileRoute } from "@tanstack/react-router";
import { AuthPanel } from "@/components/onboarding/AuthPanel";

export const Route = createFileRoute("/sign-in")({
  head: () => ({ meta: [{ title: "Sign in — Oakmonte" }] }),
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
