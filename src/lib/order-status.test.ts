import { describe, expect, test } from "bun:test";
import {
  buildTimeline,
  composeDeclineReason,
  DECLINE_REASON_MAX,
  isOrderId,
  orderRef,
  parseBefore,
  parseSellerTab,
  pickOrderPayment,
  refundStateFor,
  statusChip,
  statusesForTab,
  type TimelineFacts,
} from "./order-status";

const CREATED = "2026-10-01T09:00:00.000Z";
const PAID = "2026-10-01T09:05:00.000Z";
const SHIPPED = "2026-10-02T11:00:00.000Z";
const LATER = "2026-10-04T15:30:00.000Z";

function facts(over: Partial<TimelineFacts>): TimelineFacts {
  return {
    status: "paid",
    createdAt: CREATED,
    updatedAt: PAID,
    paidAt: PAID,
    paymentStatus: "confirmed",
    events: [],
    ...over,
  };
}

const shape = (f: TimelineFacts) => buildTimeline(f).map((s) => `${s.key}:${s.state}`);

describe("seller tabs", () => {
  test("each tab maps to its statuses, and declines share the cancelled tab", () => {
    expect(statusesForTab("to_ship")).toEqual(["paid"]);
    expect(statusesForTab("shipped")).toEqual(["shipped"]);
    expect(statusesForTab("delivered")).toEqual(["delivered"]);
    expect(statusesForTab("closed")).toEqual(["declined", "cancelled"]);
  });

  test("an unknown or missing tab falls back to To ship", () => {
    expect(parseSellerTab("closed")).toBe("closed");
    expect(parseSellerTab("nonsense")).toBe("to_ship");
    expect(parseSellerTab(undefined)).toBe("to_ship");
  });

  test("unpaid orders never land in a seller tab", () => {
    const all = (["to_ship", "shipped", "delivered", "closed"] as const).flatMap(statusesForTab);
    expect(all).not.toContain("awaiting_payment");
    expect(all).not.toContain("awaiting_acceptance");
  });
});

describe("status chips", () => {
  test("the same status reads differently to each side", () => {
    expect(statusChip("paid", "seller")).toEqual({ label: "To ship", tone: "attention" });
    expect(statusChip("paid", "buyer").label).toBe("Being prepared");
    expect(statusChip("shipped", "buyer").label).toBe("On its way");
    expect(statusChip("declined", "seller").tone).toBe("danger");
  });

  test("an unknown status is shown as-is rather than crashing", () => {
    expect(statusChip("on_hold", "buyer")).toEqual({ label: "on_hold", tone: "neutral" });
  });
});

describe("refundStateFor", () => {
  test("a refunded payment is refunded whatever the order says", () => {
    expect(refundStateFor("declined", "refunded")).toBe("refunded");
  });

  test("a closed order still holding confirmed money is owed a refund", () => {
    expect(refundStateFor("declined", "confirmed")).toBe("owed");
    expect(refundStateFor("cancelled", "confirmed")).toBe("owed");
  });

  test("nothing is owed when nothing was taken, or the order is still live", () => {
    expect(refundStateFor("declined", "pending")).toBe("none");
    expect(refundStateFor("declined", null)).toBe("none");
    expect(refundStateFor("paid", "confirmed")).toBe("none");
    expect(refundStateFor("delivered", "confirmed")).toBe("none");
  });
});

describe("pickOrderPayment", () => {
  test("prefers the payment that went through over a newer failed attempt", () => {
    const rows = [
      { id: "c", status: "failed" },
      { id: "b", status: "confirmed" },
      { id: "a", status: "pending" },
    ];
    expect(pickOrderPayment(rows)?.id).toBe("b");
  });

  test("otherwise the newest attempt, or null with none", () => {
    expect(
      pickOrderPayment([
        { id: "n", status: "pending" },
        { id: "o", status: "failed" },
      ])?.id,
    ).toBe("n");
    expect(pickOrderPayment([])).toBeNull();
  });
});

describe("composeDeclineReason", () => {
  test("joins a preset and a note", () => {
    expect(composeDeclineReason("Out of stock", "  sold in store  ")).toBe(
      "Out of stock: sold in store",
    );
  });

  test("a preset alone, or a note alone, is enough", () => {
    expect(composeDeclineReason("Out of stock", "")).toBe("Out of stock");
    expect(composeDeclineReason(null, "Sold the last one this morning")).toBe(
      "Sold the last one this morning",
    );
  });

  test("collapses whitespace so a hand-built request can't pad the reason", () => {
    expect(composeDeclineReason(null, "too\n\n   many    spaces")).toBe("too many spaces");
  });

  test("rejects nothing usable", () => {
    expect(composeDeclineReason(null, "")).toBeNull();
    expect(composeDeclineReason(null, "  ok ")).toBeNull();
    expect(composeDeclineReason("", "   ")).toBeNull();
  });

  test("caps the length the buyer is shown", () => {
    const long = composeDeclineReason(null, "x".repeat(1000));
    expect(long?.length).toBe(DECLINE_REASON_MAX);
  });
});

describe("buildTimeline", () => {
  test("an unpaid order is waiting on payment", () => {
    expect(
      shape(facts({ status: "awaiting_payment", paidAt: null, paymentStatus: "pending" })),
    ).toEqual(["placed:done", "paid:current", "shipped:upcoming", "delivered:upcoming"]);
  });

  test("a paid order is waiting to ship, with the payment's time", () => {
    const steps = buildTimeline(facts({ status: "paid" }));
    expect(steps.map((s) => `${s.key}:${s.state}`)).toEqual([
      "placed:done",
      "paid:done",
      "shipped:current",
      "delivered:upcoming",
    ]);
    expect(steps[0].at).toBe(CREATED);
    expect(steps[1].at).toBe(PAID);
  });

  test("a shipped order dates the shipment from its event, else from updated_at", () => {
    const withEvent = buildTimeline(
      facts({ status: "shipped", updatedAt: LATER, events: [{ kind: "shipped", at: SHIPPED }] }),
    );
    expect(withEvent[2]).toMatchObject({ key: "shipped", state: "done", at: SHIPPED });
    expect(withEvent[3].state).toBe("current");

    const withoutEvent = buildTimeline(facts({ status: "shipped", updatedAt: SHIPPED }));
    expect(withoutEvent[2].at).toBe(SHIPPED);
  });

  test("a delivered order without a shipped event doesn't invent a ship time", () => {
    const steps = buildTimeline(facts({ status: "delivered", updatedAt: LATER }));
    expect(steps.map((s) => s.state)).toEqual(["done", "done", "done", "done"]);
    expect(steps[2].at).toBeNull();
    expect(steps[3].at).toBe(LATER);
  });

  test("a declined order stops there, then shows its refund", () => {
    expect(
      shape(facts({ status: "declined", updatedAt: LATER, paymentStatus: "refunded" })),
    ).toEqual(["placed:done", "paid:done", "declined:stopped", "refunded:done"]);
    expect(
      shape(facts({ status: "declined", updatedAt: LATER, paymentStatus: "confirmed" })),
    ).toEqual(["placed:done", "paid:done", "declined:stopped", "refund_owed:current"]);
  });

  test("the decline is dated by its event when there is one", () => {
    const steps = buildTimeline(
      facts({
        status: "declined",
        updatedAt: LATER,
        paymentStatus: "refunded",
        events: [
          { kind: "declined", at: SHIPPED },
          { kind: "refund_started", at: LATER },
        ],
      }),
    );
    expect(steps[2].at).toBe(SHIPPED);
    expect(steps[3].at).toBe(LATER);
  });

  test("a cancelled order that was never paid has no paid or refund step", () => {
    expect(
      shape(
        facts({ status: "cancelled", paidAt: null, paymentStatus: "pending", updatedAt: LATER }),
      ),
    ).toEqual(["placed:done", "cancelled:stopped"]);
  });
});

describe("small helpers", () => {
  test("isOrderId accepts uuids only", () => {
    expect(isOrderId("7d3f2a90-1c1e-4c1b-9a55-0b1f6d7e2c11")).toBe(true);
    expect(isOrderId("7d3f2a90")).toBe(false);
    expect(isOrderId("'; drop table orders; --")).toBe(false);
  });

  test("parseBefore passes a Postgres timestamp through untouched", () => {
    expect(parseBefore("2026-10-01T09:00:00.123456+00:00")).toBe(
      "2026-10-01T09:00:00.123456+00:00",
    );
    expect(parseBefore("2026-10-01T09:00:00Z")).toBe("2026-10-01T09:00:00Z");
  });

  test("parseBefore drops anything else", () => {
    expect(parseBefore(null)).toBeNull();
    expect(parseBefore("yesterday")).toBeNull();
    expect(parseBefore("2026-10-01")).toBeNull();
    expect(parseBefore("2026-10-01T09:00:00Z,status.eq.paid")).toBeNull();
  });

  test("orderRef is the first block of the id, uppercased", () => {
    expect(orderRef("7d3f2a90-1c1e-4c1b-9a55-0b1f6d7e2c11")).toBe("#7D3F2A90");
  });
});
