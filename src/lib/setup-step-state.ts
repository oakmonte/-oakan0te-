/** What a setup step's status mark should say.
 *
 *  Three states, not two. The checklist used to render one hardcoded amber dot
 *  whenever a step was `done`, so a finished store looked like a store with
 *  five things still pending -- the opposite of what the seller had earned.
 *
 *    todo         nothing has happened yet
 *    in-progress  the seller has done their part, something else has not
 *                 finished yet, and there is nothing more for them to do
 *    done         finished
 */
export type StepState = "todo" | "in-progress" | "done";

/** The payout step, which is the only one with a real middle state.
 *
 *  Adding a bank account is not the same as that account being verified, so
 *  this is the one step where "the seller did their part" and "this is
 *  finished" genuinely differ.
 *
 *  Anything that is not literally "verified" counts as pending, rather than
 *  matching "pending" explicitly. The column is a plain `text` with no enum
 *  behind it, so an unrecognised value has to fall somewhere -- and falling to
 *  "not finished yet" is the safe direction. Claiming a payout account is
 *  verified when we do not know that is how a seller ends up expecting money
 *  that cannot arrive.
 *
 *  Note this is display-only. `payoutSet` alone gates whether setup can be
 *  completed -- see the comment on payoutStatus in use-store-setup-status.ts
 *  for why gating anything structural on verification would strand every
 *  seller. */
export function payoutStepState(payoutSet: boolean, payoutStatus: string | null): StepState {
  if (!payoutSet) return "todo";
  return payoutStatus === "verified" ? "done" : "in-progress";
}

/** Every other step: binary, because there is no third party to wait on. */
export function plainStepState(done: boolean): StepState {
  return done ? "done" : "todo";
}
