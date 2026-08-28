import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/integrations/my-supabase/client";
import { readIntent, type Intent } from "@/lib/onboarding-state";
import { firstRoleSpecificStep } from "@/lib/onboarding-flow";
import { OnboardingChecking, OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { useRequireSession } from "@/components/onboarding/use-require-session";

export const Route = createFileRoute("/switching-roles")({
  head: () => ({ meta: [{ title: "Welcome back — Oakmonte" }] }),
  component: SwitchingRolesPage,
});

const ROLE_LABEL: Record<Intent, string> = {
  seller: "seller",
  creator: "creator",
  curator: "curator",
};

// Only reachable via resolvePostAuthRedirect, which sets the target role in
// storage right before sending someone here — see src/lib/auth.ts. Not part
// of FLOWS in onboarding-flow.ts: this isn't a step in a fresh signup, it's
// a one-off beat for an existing account picking up a second role.
function SwitchingRolesPage() {
  const navigate = useNavigate();
  const { userId, checking } = useRequireSession();
  const [existingRole, setExistingRole] = useState<Intent | null>(null);
  // Read after mount, same reasoning as the rest of onboarding: reading
  // storage during render served a stale value from the server on hydration.
  const [targetRole, setTargetRole] = useState<Intent | null>(null);

  useEffect(() => {
    setTargetRole(readIntent());
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("account_type")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error("SwitchingRolesPage: failed to load account type", error);
        setExistingRole((data?.account_type as Intent | null) ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (checking || !targetRole) return <OnboardingChecking />;

  const existingLabel = existingRole ? ROLE_LABEL[existingRole] : "with us";
  const targetLabel = ROLE_LABEL[targetRole];

  return (
    <OnboardingShell
      title="Welcome back"
      subtitle={`We know you're already set up as a ${existingLabel} — let's get you set up as a ${targetLabel} too.`}
    >
      <button
        type="button"
        onClick={() => navigate({ to: firstRoleSpecificStep(targetRole), replace: true })}
        className="w-full rounded-full bg-brand-accent text-brand-bg py-3.5 text-sm font-medium uppercase tracking-widest hover:bg-brand-accent/90 transition-all duration-300"
      >
        Continue
      </button>
    </OnboardingShell>
  );
}
