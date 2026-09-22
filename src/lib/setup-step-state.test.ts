import { test, expect, describe } from "bun:test";
import { payoutStepState, plainStepState } from "./setup-step-state";

describe("payoutStepState", () => {
  test("no account yet is todo", () => {
    expect(payoutStepState(false, null)).toBe("todo");
    // Status is meaningless without an account, and must not promote the step.
    expect(payoutStepState(false, "verified")).toBe("todo");
  });

  // The state the whole app is in today: api.store.payout.ts hardcodes
  // "pending" on insert and nothing ever writes "verified", because Paystack
  // isn't connected. Amber here is the truth, not a bug.
  test("an account awaiting verification is in-progress, not done", () => {
    expect(payoutStepState(true, "pending")).toBe("in-progress");
  });

  test("a verified account is done", () => {
    expect(payoutStepState(true, "verified")).toBe("done");
  });

  // store_payout_accounts.status is plain `text` with no enum behind it, so an
  // unrecognised value has to fall somewhere. It must fall short of "done":
  // telling a seller their payouts are verified when we don't know that is how
  // they end up expecting money that cannot arrive.
  test("an unrecognised or missing status never reads as done", () => {
    expect(payoutStepState(true, null)).toBe("in-progress");
    expect(payoutStepState(true, "")).toBe("in-progress");
    expect(payoutStepState(true, "PENDING")).toBe("in-progress");
    expect(payoutStepState(true, "Verified")).toBe("in-progress");
    expect(payoutStepState(true, "under_review")).toBe("in-progress");
  });
});

describe("plainStepState", () => {
  test("is binary", () => {
    expect(plainStepState(true)).toBe("done");
    expect(plainStepState(false)).toBe("todo");
  });
});
