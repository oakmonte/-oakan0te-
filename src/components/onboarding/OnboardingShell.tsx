import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import type { OnboardingStep } from "@/lib/onboarding-flow";

type Props = {
  title: string;
  subtitle?: ReactNode;
  /** Omitted on the first step of a flow — the account already exists by then,
   *  so there is nothing useful behind it. */
  backTo?: OnboardingStep | null;
  step?: { current: number; total: number };
  onSkip?: () => void;
  children: ReactNode;
};

function Progress({ current, total }: { current: number; total: number }) {
  return (
    <div
      className="flex items-center gap-1.5"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current}
      aria-label={`Step ${current} of ${total}`}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-0.5 w-6 rounded-full transition-colors duration-300 ${
            i < current ? "bg-brand-accent" : "bg-brand-text/20"
          }`}
        />
      ))}
      <span className="ml-2 text-[10px] uppercase tracking-widest text-brand-text/50 tabular-nums">
        {current}/{total}
      </span>
    </div>
  );
}

export function OnboardingShell({ title, subtitle, backTo, step, onSkip, children }: Props) {
  const showHeader = Boolean(backTo || step || onSkip);

  return (
    // min-h-dvh, not min-h-screen: with the mobile keyboard open 100vh overflows
    // and pushes the submit button off-screen.
    <div data-onboarding className="min-h-dvh bg-brand-bg text-brand-text flex flex-col">
      {showHeader && (
        <header className="px-6 sm:px-10 py-6 flex items-center justify-between gap-4">
          <div className="flex-1 flex justify-start">
            {backTo ? (
              <Link
                to={backTo}
                className="text-[11px] uppercase tracking-widest hover:text-brand-accent transition-colors"
              >
                ← Back
              </Link>
            ) : (
              <span aria-hidden="true" />
            )}
          </div>
          {step && step.current > 0 && <Progress current={step.current} total={step.total} />}
          <div className="flex-1 flex justify-end">
            {onSkip ? (
              <button
                type="button"
                onClick={onSkip}
                className="text-[11px] uppercase tracking-widest text-brand-text/60 hover:text-brand-text transition-colors"
              >
                Skip
              </button>
            ) : (
              <span aria-hidden="true" />
            )}
          </div>
        </header>
      )}

      <main className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm text-center">
          <h1 className="font-serif text-4xl sm:text-5xl leading-tight mb-3">{title}</h1>
          {subtitle && <p className="text-sm text-brand-text/70 mb-8">{subtitle}</p>}
          {children}
        </div>
      </main>
    </div>
  );
}

/** Shown while `useRequireSession` decides whether there is a session. */
export function OnboardingChecking() {
  return (
    <div className="min-h-dvh bg-brand-bg text-brand-text flex flex-col items-center justify-center px-6 text-center">
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="font-loading-display text-2xl sm:text-3xl leading-tight text-brand-text/90 max-w-xs"
      >
        we take the headaches so you stay creative.
      </motion.p>
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="mt-3 text-xs text-brand-text/40 font-normal tracking-wide"
      >
        loading…..
      </motion.span>
    </div>
  );
}

/** Errors were plain <p> tags before, so a screen reader never announced a
 *  failed submit. */
export function FormError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" aria-live="assertive" className="text-xs text-red-600 text-center">
      {children}
    </p>
  );
}
