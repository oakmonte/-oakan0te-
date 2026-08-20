import type { Intent } from "./onboarding-state";

// The single source of truth for step order. Every onboarding route derives its
// "next", "back" and "step N of M" from here — the old hardcoded per-route
// ternaries are what let the curator flow loop between /phone-number and
// /find-your-fit forever.
export type OnboardingStep =
  | "/choose-username"
  | "/seller-type"
  | "/where-did-you-hear-about-us"
  | "/name-your-store"
  | "/find-your-fit";

export const FLOWS: Record<Intent, readonly OnboardingStep[]> = {
  seller: ["/choose-username", "/seller-type", "/where-did-you-hear-about-us", "/name-your-store"],
  creator: ["/choose-username", "/where-did-you-hear-about-us", "/find-your-fit"],
  curator: ["/choose-username", "/where-did-you-hear-about-us", "/find-your-fit"],
};

export function flowFor(intent: Intent | null): readonly OnboardingStep[] {
  return FLOWS[intent ?? "seller"];
}

/** 1-based position of `step`, plus the flow length. `current` is 0 if the step
 *  isn't part of this flow (e.g. a creator who typed /seller-type by hand). */
export function stepPosition(intent: Intent | null, step: OnboardingStep) {
  const flow = flowFor(intent);
  return { current: flow.indexOf(step) + 1, total: flow.length };
}

/** The step after `step`, or null when `step` is the last one in the flow. */
export function nextStep(intent: Intent | null, step: OnboardingStep): OnboardingStep | null {
  const flow = flowFor(intent);
  const index = flow.indexOf(step);
  if (index === -1) return null;
  return flow[index + 1] ?? null;
}

/** The step before `step`, or null when `step` is the first one. There is
 *  deliberately no "back" out of the first step — the account already exists by
 *  then, so the auth page behind it has nothing left to do. */
export function previousStep(intent: Intent | null, step: OnboardingStep): OnboardingStep | null {
  const flow = flowFor(intent);
  const index = flow.indexOf(step);
  if (index <= 0) return null;
  return flow[index - 1] ?? null;
}

/** Where all three flows end, before the profile.
 *
 *  Deliberately NOT a member of FLOWS: it asks the user for nothing, so
 *  counting it would inflate every "step N of M" by one and make the last form
 *  read 4/5 when it is the final thing to fill in. */
export const COMPLETION_STEP = "/welcome" as const;

export type OnboardingRoute = OnboardingStep | typeof COMPLETION_STEP;

/** The route to send the user to after `step` — the next form while there is
 *  one, then the completion screen.
 *
 *  Every caller used to fall back to `{ to: "/" }` when nextStep ran out, which
 *  dropped a user who had just finished onboarding onto the marketing page. */
export function nextRoute(intent: Intent | null, step: OnboardingStep): OnboardingRoute {
  return nextStep(intent, step) ?? COMPLETION_STEP;
}
