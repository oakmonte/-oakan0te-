import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import type { Intent } from "@/lib/onboarding-state";
import { nextRoute, type OnboardingStep } from "@/lib/onboarding-flow";
import { FIND_YOUR_FIT_IMAGE_TIERS } from "@/lib/find-your-fit-assets";
import { warmImageTiers } from "@/lib/warm-images";

/** Starts fetching the next onboarding screen (and, for /find-your-fit, its
 *  images) while the user is still on the current one, so the tap that moves
 *  them forward lands on something already in memory.
 *
 *  Pure head-start: no navigation, no state, failures ignored. `intent` can be
 *  null while it's still being resolved -- the effect re-runs once it settles. */
export function usePrefetchNextStep(intent: Intent | null, step: OnboardingStep) {
  const router = useRouter();

  useEffect(() => {
    const to = nextRoute(intent, step);
    let cancelWarm: (() => void) | undefined;

    const id = window.setTimeout(() => {
      void router.preloadRoute({ to }).catch(() => {});
      if (to === "/find-your-fit") cancelWarm = warmImageTiers(FIND_YOUR_FIT_IMAGE_TIERS);
    }, 0);

    return () => {
      window.clearTimeout(id);
      cancelWarm?.();
    };
  }, [router, intent, step]);
}
